import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1ERC20Deposit__factory } from '../../typechain'
import { deploy, deployMock } from '../helpers'

const INITIAL_TOTAL_L1_SUPPLY = 3000

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageSender: 'OVM_XCHAIN: wrong sender of cross-domain message',
  daiInsufficientAllowance: 'Dai/insufficient-allowance',
  daiInsufficientBalance: 'Dai/insufficient-balance',
}

describe('L1ERC20Deposit', () => {
  describe('deposit()', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [escrow, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1Erc20Deposit, l1CrossDomainMessengerMock, l2MinterMock } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      const depositAmount = 100
      await l1Dai.connect(user1).approve(l1Erc20Deposit.address, depositAmount)
      await l1Erc20Deposit.connect(user1).deposit(depositAmount)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(INITIAL_TOTAL_L1_SUPPLY - depositAmount)
      expect(await l1Dai.balanceOf(l1Erc20Deposit.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2MinterMock.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2MinterMock.interface.encodeFunctionData('finalizeDeposit', [user1.address, depositAmount]),
      )
    })

    it('fails when approval is too low', async () => {
      const [escrow, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1Erc20Deposit } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      const depositAmount = 100
      await l1Dai.connect(user1).approve(l1Erc20Deposit.address, 0)
      await expect(l1Erc20Deposit.connect(user1).deposit(depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientAllowance,
      )
    })

    it('fails when funds too low', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Erc20Deposit } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      const depositAmount = 100
      await l1Dai.connect(user2).approve(l1Erc20Deposit.address, depositAmount)
      await expect(l1Erc20Deposit.connect(user2).deposit(depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientBalance,
      )
    })
  })

  describe('depositTo()', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Erc20Deposit, l1CrossDomainMessengerMock, l2MinterMock } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      const depositAmount = 100
      await l1Dai.connect(user1).approve(l1Erc20Deposit.address, depositAmount)
      await l1Erc20Deposit.connect(user1).depositTo(user2.address, depositAmount)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(INITIAL_TOTAL_L1_SUPPLY - depositAmount)
      expect(await l1Dai.balanceOf(l1Erc20Deposit.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2MinterMock.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2MinterMock.interface.encodeFunctionData('finalizeDeposit', [user2.address, depositAmount]),
      )
    })

    it('fails when approval is too low', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Erc20Deposit } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      const depositAmount = 100
      await l1Dai.connect(user1).approve(l1Erc20Deposit.address, 0)
      await expect(l1Erc20Deposit.connect(user1).depositTo(user2.address, depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientAllowance,
      )
    })

    it('fails when funds too low', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Erc20Deposit } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      const depositAmount = 100
      await l1Dai.connect(user2).approve(l1Erc20Deposit.address, depositAmount)
      await expect(l1Erc20Deposit.connect(user2).depositTo(user1.address, depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientBalance,
      )
    })
  })
})

async function setupTest(signers: {
  l1MessengerImpersonator: SignerWithAddress
  escrow: SignerWithAddress
  user1: SignerWithAddress
}) {
  const l2MinterMock = await deployMock('L2ERC20Minter')
  const l1CrossDomainMessengerMock = await deployMock(
    'OVM_L1CrossDomainMessenger',
    { address: await signers.l1MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l1Dai = await deploy<Dai__factory>('Dai', [])
  const l1Erc20Deposit = await deploy<L1ERC20Deposit__factory>('L1ERC20Deposit', [
    l1Dai.address,
    l2MinterMock.address,
    l1CrossDomainMessengerMock.address,
    signers.escrow.address,
  ])
  await l1Dai.mint(signers.user1.address, INITIAL_TOTAL_L1_SUPPLY)

  return { l1Dai, l1Erc20Deposit, l1CrossDomainMessengerMock, l2MinterMock }
}
