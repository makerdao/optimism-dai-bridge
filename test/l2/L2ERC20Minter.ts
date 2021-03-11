import { MockContract, ModifiableContract, smockit, smoddit } from '@eth-optimism/smock'
import { expect } from 'chai'
import { Contract, ContractFactory, Signer } from 'ethers'
import { ethers } from 'hardhat'

import { NON_ZERO_ADDRESS, ZERO_ADDRESS } from '../helpers'

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER = 'OVM_XCHAIN: wrong sender of cross-domain message'
const MOCK_L1DEPOSIT_ADDRESS: string = '0x1234123412341234123412341234123412341234'

describe('OVM_L2DepositedERC20', () => {
  let alice: Signer
  let bob: Signer
  let Factory__OVM_L1ERC20Gateway: ContractFactory
  before(async () => {
    ;[alice, bob] = await ethers.getSigners()
    Factory__OVM_L1ERC20Gateway = await ethers.getContractFactory('L1ERC20Deposit')
  })

  let DAI: Contract
  let L2Minter: Contract
  let Mock__OVM_L2CrossDomainMessenger: MockContract
  let finalizeWithdrawalGasLimit: number
  beforeEach(async () => {
    // Create a special signer which will enable us to send messages from the L2Messenger contract
    const [l2MessengerImpersonator] = await ethers.getSigners()

    // Get a new mock L2 messenger
    Mock__OVM_L2CrossDomainMessenger = await smockit(
      await ethers.getContractFactory('OVM_L2CrossDomainMessenger'),
      // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
      { address: await l2MessengerImpersonator.getAddress() },
    )

    // Deploy the contract under test
    DAI = await (await ethers.getContractFactory('Dai')).deploy()
    L2Minter = await (await ethers.getContractFactory('L2ERC20Minter')).deploy(
      Mock__OVM_L2CrossDomainMessenger.address,
      DAI.address,
    )
    await DAI.rely(L2Minter.address)

    // initialize the L2 Gateway with the L1G ateway addrss
    await L2Minter.init(MOCK_L1DEPOSIT_ADDRESS)

    finalizeWithdrawalGasLimit = await L2Minter.getFinalizeWithdrawalL1Gas()
  })

  // test the transfer flow of moving a token from L2 to L1
  describe('finalizeDeposit', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L2 account', async () => {
      // Deploy new gateway, initialize with random messenger
      L2Minter = await (await ethers.getContractFactory('L2ERC20Minter')).deploy(NON_ZERO_ADDRESS, DAI.address)
      await L2Minter.init(NON_ZERO_ADDRESS)

      const depositAmount = 100
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(() => MOCK_L1DEPOSIT_ADDRESS)
      await expect(L2Minter.finalizeDeposit(await alice.getAddress(), depositAmount, {})).to.be.revertedWith(
        ERR_INVALID_MESSENGER,
      )
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ERC20Gateway)', async () => {
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(NON_ZERO_ADDRESS)

      await expect(
        L2Minter.finalizeDeposit(ZERO_ADDRESS, 0, {
          from: Mock__OVM_L2CrossDomainMessenger.address,
        }),
      ).to.be.revertedWith(ERR_INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should credit funds to the depositor', async () => {
      const depositAmount = 100
      Mock__OVM_L2CrossDomainMessenger.smocked.xDomainMessageSender.will.return.with(() => MOCK_L1DEPOSIT_ADDRESS)

      await L2Minter.finalizeDeposit(await alice.getAddress(), depositAmount, {
        from: Mock__OVM_L2CrossDomainMessenger.address,
      })

      const aliceBalance = await DAI.balanceOf(await alice.getAddress())
      aliceBalance.should.equal(depositAmount)
    })
  })

  describe('withdrawals', () => {
    const INITIAL_TOTAL_SUPPLY = 100_000
    const ALICE_INITIAL_BALANCE = 50_000
    const withdrawAmount = 1_000
    let L2Minter: Contract
    let DAI: ModifiableContract
    beforeEach(async () => {
      // Deploy a smodded gateway so we can give some balances to withdraw
      // Deploy the contract under test
      DAI = await (await smoddit('Dai')).deploy()
      L2Minter = await (await ethers.getContractFactory('L2ERC20Minter', alice)).deploy(
        Mock__OVM_L2CrossDomainMessenger.address,
        DAI.address,
      )
      await DAI.rely(L2Minter.address)

      // initialize the L2 Gateway with the L1G ateway addrss
      await L2Minter.init(MOCK_L1DEPOSIT_ADDRESS)

      // Populate the initial state with a total supply and some money in alice's balance
      const aliceAddress = await alice.getAddress()
      DAI.smodify.put({
        totalSupply: INITIAL_TOTAL_SUPPLY,
        balanceOf: {
          [aliceAddress]: ALICE_INITIAL_BALANCE,
        },
        allowance: {
          [aliceAddress]: {
            [L2Minter.address]: ALICE_INITIAL_BALANCE,
          },
        },
      })
    })

    it('withdraw() burns and sends the correct withdrawal message', async () => {
      await L2Minter.withdraw(withdrawAmount)
      const withdrawalCallToMessenger = Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert Alice's balance went down
      const aliceBalance = await DAI.balanceOf(await alice.getAddress())
      expect(aliceBalance).to.deep.equal(ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount))

      // Assert totalSupply went down
      const newTotalSupply = await DAI.totalSupply()
      expect(newTotalSupply).to.deep.equal(ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount))

      // Assert the correct cross-chain call was sent:
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(MOCK_L1DEPOSIT_ADDRESS)
      // Message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        Factory__OVM_L1ERC20Gateway.interface.encodeFunctionData('finalizeWithdrawal', [
          await alice.getAddress(),
          withdrawAmount,
        ]),
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(finalizeWithdrawalGasLimit)
    })

    it('withdrawTo() burns and sends the correct withdrawal message', async () => {
      await L2Minter.withdrawTo(await bob.getAddress(), withdrawAmount)
      const withdrawalCallToMessenger = Mock__OVM_L2CrossDomainMessenger.smocked.sendMessage.calls[0]

      // Assert Alice's balance went down
      const aliceBalance = await DAI.balanceOf(await alice.getAddress())
      expect(aliceBalance).to.deep.equal(ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount))

      // Assert totalSupply went down
      const newTotalSupply = await DAI.totalSupply()
      expect(newTotalSupply).to.deep.equal(ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount))

      // Assert the correct cross-chain call was sent.
      // Message should be sent to the L1ERC20Gateway on L1
      expect(withdrawalCallToMessenger._target).to.equal(MOCK_L1DEPOSIT_ADDRESS)
      // The message data should be a call telling the L1ERC20Gateway to finalize the withdrawal
      expect(withdrawalCallToMessenger._message).to.equal(
        Factory__OVM_L1ERC20Gateway.interface.encodeFunctionData('finalizeWithdrawal', [
          await bob.getAddress(),
          withdrawAmount,
        ]),
      )
      // Hardcoded gaslimit should be correct
      expect(withdrawalCallToMessenger._gasLimit).to.equal(finalizeWithdrawalGasLimit)
    })
  })

  // low priority todos: see question in contract
  describe.skip('Initialization logic', () => {
    it('should not allow calls to onlyInitialized functions', async () => {
      // TODO
    })

    it('should only allow initialization once and emits initialized event', async () => {
      // TODO
    })
  })
})
