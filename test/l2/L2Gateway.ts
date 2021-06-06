import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L2Gateway__factory } from '../../typechain'
import { deploy, deployMock, deployOptimismContractMock } from '../helpers'

const defaultGas = 0
const defaultData = '0x'

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageOriginator: 'OVM_XCHAIN: wrong sender of cross-domain message',
  alreadyInitialized: 'L2Gateway/already-init',
  notInitialized: 'L2Gateway/not-init',
  bridgeClosed: 'L2Gateway/closed',
  notOwner: 'L2Gateway/not-authorized',
  daiInsufficientAllowance: 'Dai/insufficient-allowance',
  daiInsufficientBalance: 'Dai/insufficient-balance',
  daiNotAuthorized: 'Dai/not-authorized',
}

describe('OVM_L2Gateway', () => {
  describe('finalizeDeposit', () => {
    const depositAmount = 100

    it('mints new tokens', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1GatewayMock, l2CrossDomainMessengerMock, l2Gateway, l2Dai, l1Dai } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GatewayMock.address)

      await l2Gateway
        .connect(l2MessengerImpersonator)
        .finalizeDeposit(l1Dai.address, l2Dai.address, user1.address, user1.address, depositAmount, defaultData)

      expect(await l2Dai.balanceOf(user1.address)).to.be.eq(depositAmount)
      expect(await l2Dai.totalSupply()).to.be.eq(depositAmount)
    })

    // pending deposits MUST success even if bridge is closed
    it('completes deposits even when closed', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1GatewayMock, l2CrossDomainMessengerMock, l2Gateway, l2Dai, l1Dai } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2Gateway.close()
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GatewayMock.address)

      await l2Gateway
        .connect(l2MessengerImpersonator)
        .finalizeDeposit(l1Dai.address, l2Dai.address, user1.address, user1.address, depositAmount, defaultData)

      expect(await l2Dai.balanceOf(user1.address)).to.be.eq(depositAmount)
      expect(await l2Dai.totalSupply()).to.be.eq(depositAmount)
    })

    // if bridge is closed properly this shouldn't happen
    it('reverts when DAI minting access was revoked', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1GatewayMock, l2CrossDomainMessengerMock, l2Gateway, l2Dai, l1Dai } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GatewayMock.address)

      await l2Dai.deny(l2Gateway.address)

      await expect(
        l2Gateway
          .connect(l2MessengerImpersonator)
          .finalizeDeposit(l1Dai.address, l2Dai.address, user1.address, user1.address, depositAmount, defaultData),
      ).to.be.revertedWith(errorMessages.daiNotAuthorized)
    })

    it('reverts when called not by XDomainMessenger', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1GatewayMock, l2CrossDomainMessengerMock, l2Gateway, l1Dai, l2Dai } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GatewayMock.address)

      await expect(
        l2Gateway
          .connect(user2)
          .finalizeDeposit(l1Dai.address, l2Dai.address, user1.address, user1.address, depositAmount, defaultData),
      ).to.be.revertedWith(errorMessages.invalidMessenger)
    })

    it('reverts when called by XDomainMessenger but not relying message from l1Gateway', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l2CrossDomainMessengerMock, l2Gateway, l1Dai, l2Dai } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => user2.address)

      await expect(
        l2Gateway
          .connect(l2MessengerImpersonator)
          .finalizeDeposit(l1Dai.address, l2Dai.address, user1.address, user1.address, depositAmount, defaultData),
      ).to.be.revertedWith(errorMessages.invalidXDomainMessageOriginator)
    })
  })

  describe('withdraw', () => {
    const withdrawAmount = 100

    it('sends xchain message and burns tokens', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1GatewayMock, l2CrossDomainMessengerMock, l2Dai, l2Gateway, l1Dai } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })

      await l2Gateway.connect(user1).withdraw(l2Dai.address, withdrawAmount, defaultGas, defaultData)
      const withdrawCallToMessengerCall = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l2Dai.balanceOf(user1.address)).to.equal(INITIAL_TOTAL_L1_SUPPLY - withdrawAmount)
      expect(await l2Dai.totalSupply()).to.equal(INITIAL_TOTAL_L1_SUPPLY - withdrawAmount)

      expect(withdrawCallToMessengerCall._target).to.equal(l1GatewayMock.address)
      expect(withdrawCallToMessengerCall._message).to.equal(
        l1GatewayMock.interface.encodeFunctionData('finalizeERC20Withdrawal', [
          l1Dai.address,
          l2Dai.address,
          user1.address,
          user1.address,
          withdrawAmount,
          defaultData,
        ]),
      )
      //@todo: assert event
    })

    it('reverts when approval is too low', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l2Dai, l2Gateway } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2Dai.connect(user1).transfer(user2.address, withdrawAmount)

      await expect(
        l2Gateway.connect(user2).withdraw(l2Dai.address, withdrawAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientAllowance)
    })

    it('reverts when not enough funds', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l2Dai, l2Gateway } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2Dai.connect(user1).approve(l2Gateway.address, withdrawAmount)

      await expect(
        l2Gateway.connect(user2).withdraw(l2Dai.address, withdrawAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientBalance)
    })

    it('reverts when bridge is closed', async () => {
      const [owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Gateway, l2Dai } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2Gateway.connect(owner).close()

      await expect(
        l2Gateway.connect(user1).withdraw(l2Dai.address, withdrawAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.bridgeClosed)
    })
  })

  describe('withdrawTo', () => {
    const withdrawAmount = 100

    it('sends xchain message and burns tokens', async () => {
      const [_, l2MessengerImpersonator, receiver, user1] = await ethers.getSigners()
      const { l1GatewayMock, l2CrossDomainMessengerMock, l2Dai, l2Gateway, l1Dai } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })

      await l2Gateway
        .connect(user1)
        .withdrawTo(l2Dai.address, receiver.address, withdrawAmount, defaultGas, defaultData)
      const withdrawCallToMessengerCall = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l2Dai.balanceOf(user1.address)).to.equal(INITIAL_TOTAL_L1_SUPPLY - withdrawAmount)
      expect(await l2Dai.totalSupply()).to.equal(INITIAL_TOTAL_L1_SUPPLY - withdrawAmount)

      expect(withdrawCallToMessengerCall._target).to.equal(l1GatewayMock.address)
      expect(withdrawCallToMessengerCall._message).to.equal(
        l1GatewayMock.interface.encodeFunctionData('finalizeERC20Withdrawal', [
          l1Dai.address,
          l2Dai.address,
          user1.address,
          receiver.address,
          withdrawAmount,
          defaultData,
        ]),
      )
    })

    it('reverts when approval is too low', async () => {
      const [_, l2MessengerImpersonator, receiver, user1, user2] = await ethers.getSigners()
      const { l2Dai, l2Gateway } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2Dai.connect(user1).transfer(user2.address, withdrawAmount)

      await expect(
        l2Gateway.connect(user2).withdrawTo(l2Dai.address, receiver.address, withdrawAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientAllowance)
    })

    it('reverts when not enough funds', async () => {
      const [_, l2MessengerImpersonator, receiver, user1, user2] = await ethers.getSigners()
      const { l2Dai, l2Gateway } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2Dai.connect(user1).approve(l2Gateway.address, withdrawAmount)

      await expect(
        l2Gateway.connect(user2).withdrawTo(l2Dai.address, receiver.address, withdrawAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientBalance)
    })

    it('reverts when bridge is closed', async () => {
      const [owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Gateway, l2Dai } = await setupWithdrawTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2Gateway.connect(owner).close()

      await expect(
        l2Gateway.connect(user1).withdrawTo(l2Dai.address, user1.address, withdrawAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.bridgeClosed)
    })
  })

  describe('init', () => {
    it('sets token gateway', async () => {
      const [xDomainMessenger, l1Dai, l2Dai, l1Gateway] = await ethers.getSigners()

      const l2Gateway = await deploy<L2Gateway__factory>('L2Gateway', [xDomainMessenger.address, l2Dai.address])

      await l2Gateway.init(l1Gateway.address, l1Dai.address)

      expect(await l2Gateway.messenger()).to.eq(xDomainMessenger.address)
      expect(await l2Gateway.l1Gateway()).to.eq(l1Gateway.address)
      expect(await l2Gateway.l1Token()).to.eq(l1Dai.address)
      expect(await l2Gateway.token()).to.eq(l2Dai.address)
    })

    it('allows initialization only once', async () => {
      const [xDomainMessenger, l1Dai, l2Dai, l1Gateway, l1Dai2, l1Gateway2] = await ethers.getSigners()

      const l2Gateway = await deploy<L2Gateway__factory>('L2Gateway', [xDomainMessenger.address, l2Dai.address])

      await l2Gateway.init(l1Gateway.address, l1Dai.address)

      await expect(l2Gateway.init(l1Gateway2.address, l1Dai2.address)).to.be.revertedWith(
        errorMessages.alreadyInitialized,
      )
    })

    it('doesnt allow calls to onlyInitialized functions before initialization', async () => {
      const [xDomainMessenger, l1Dai, l2Dai, user1] = await ethers.getSigners()

      const l2Gateway = await deploy<L2Gateway__factory>('L2Gateway', [xDomainMessenger.address, l2Dai.address])

      await expect(l2Gateway.withdraw(l2Dai.address, '100', defaultGas, defaultData)).to.be.revertedWith(
        errorMessages.notInitialized,
      )
      await expect(
        l2Gateway.withdrawTo(l2Dai.address, user1.address, '100', defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.notInitialized)
      await expect(
        l2Gateway.finalizeDeposit(l1Dai.address, l2Dai.address, user1.address, user1.address, '100', defaultData),
      ).to.be.revertedWith(errorMessages.notInitialized)
    })
  })

  describe('close()', () => {
    it('can be called by owner', async () => {
      const [owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Gateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      expect(await l2Gateway.isOpen()).to.be.eq(1)
      await l2Gateway.connect(owner).close()

      expect(await l2Gateway.isOpen()).to.be.eq(0)
    })

    it('can be called multiple times by the owner but nothing changes', async () => {
      const [owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Gateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      await l2Gateway.connect(owner).close()
      expect(await l2Gateway.isOpen()).to.be.eq(0)

      await l2Gateway.connect(owner).close()
      expect(await l2Gateway.isOpen()).to.be.eq(0)
    })

    it('reverts when called not by the owner', async () => {
      const [_owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Gateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      await expect(l2Gateway.connect(user1).close()).to.be.revertedWith(errorMessages.notOwner)
    })
  })
})

async function setupTest(signers: { l2MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const l2CrossDomainMessengerMock = await deployOptimismContractMock(
    'OVM_L2CrossDomainMessenger',
    { address: await signers.l2MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l1Dai = await deploy<Dai__factory>('Dai')
  const l2Dai = await deploy<Dai__factory>('Dai')
  const l2Gateway = await deploy<L2Gateway__factory>('L2Gateway', [l2CrossDomainMessengerMock.address, l2Dai.address])
  const l1GatewayMock = await deployMock('L1Gateway')

  await l2Dai.rely(l2Gateway.address)
  await l2Gateway.init(l1GatewayMock.address, l1Dai.address)

  return { l2Dai, l1GatewayMock, l2CrossDomainMessengerMock, l2Gateway, l1Dai }
}

const INITIAL_TOTAL_L1_SUPPLY = 3000

async function setupWithdrawTest(signers: { l2MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const contracts = await setupTest(signers)

  await contracts.l2Dai.mint(signers.user1.address, INITIAL_TOTAL_L1_SUPPLY)
  await contracts.l2Dai.connect(signers.user1).approve(contracts.l2Gateway.address, ethers.constants.MaxUint256)

  return contracts
}
