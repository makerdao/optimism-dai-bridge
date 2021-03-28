import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1ERC20Gateway__factory } from '../../typechain'
import { deploy, deployMock } from '../helpers'

const initialTotalL1Supply = 3000
const depositAmount = 100

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageOriginator: 'OVM_XCHAIN: wrong sender of cross-domain message',
  bridgeClosed: 'L1ERC20Gateway/closed',
  notOwner: 'Ownable: caller is not the owner',
  daiInsufficientAllowance: 'Dai/insufficient-allowance',
  daiInsufficientBalance: 'Dai/insufficient-balance',
}

describe('L1ERC20Gateway', () => {
  describe('deposit()', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [escrow, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway, l1CrossDomainMessengerMock, l2DepositedTokenMock } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1ERC20Gateway.address, depositAmount)
      await l1ERC20Gateway.connect(user1).deposit(depositAmount)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1ERC20Gateway.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2DepositedTokenMock.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2DepositedTokenMock.interface.encodeFunctionData('finalizeDeposit', [user1.address, depositAmount]),
      )
    })

    it('reverts when approval is too low', async () => {
      const [escrow, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1ERC20Gateway.address, 0)
      await expect(l1ERC20Gateway.connect(user1).deposit(depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientAllowance,
      )
    })

    it('reverts when funds too low', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user2).approve(l1ERC20Gateway.address, depositAmount)
      await expect(l1ERC20Gateway.connect(user2).deposit(depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientBalance,
      )
    })

    it('reverts when bridge is closed', async () => {
      const [escrow, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1ERC20Gateway.close()

      await l1Dai.connect(user1).approve(l1ERC20Gateway.address, depositAmount)

      await expect(l1ERC20Gateway.connect(user1).deposit(depositAmount)).to.be.revertedWith(errorMessages.bridgeClosed)
    })
  })

  describe('depositTo()', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway, l1CrossDomainMessengerMock, l2DepositedTokenMock } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1ERC20Gateway.address, depositAmount)
      await l1ERC20Gateway.connect(user1).depositTo(user2.address, depositAmount)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1ERC20Gateway.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2DepositedTokenMock.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2DepositedTokenMock.interface.encodeFunctionData('finalizeDeposit', [user2.address, depositAmount]),
      )
    })

    it('reverts when approval is too low', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1ERC20Gateway.address, 0)
      await expect(l1ERC20Gateway.connect(user1).depositTo(user2.address, depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientAllowance,
      )
    })

    it('reverts when funds too low', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user2).approve(l1ERC20Gateway.address, depositAmount)
      await expect(l1ERC20Gateway.connect(user2).depositTo(user1.address, depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientBalance,
      )
    })

    it('reverts when bridge is closed', async () => {
      const [escrow, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway } = await setupTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      await l1ERC20Gateway.close()

      await l1Dai.connect(user1).approve(l1ERC20Gateway.address, depositAmount)

      await expect(l1ERC20Gateway.connect(user1).depositTo(user1.address, depositAmount)).to.be.revertedWith(
        errorMessages.bridgeClosed,
      )
    })
  })

  describe('finalizeWithdrawal', () => {
    const withdrawAmount = 100

    it('sends funds from the escrow', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway, l1CrossDomainMessengerMock, l2DepositedTokenMock } = await setupWithdrawTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DepositedTokenMock.address)

      await l1ERC20Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount)

      expect(await l1Dai.balanceOf(user2.address)).to.be.equal(withdrawAmount)
      expect(await l1Dai.balanceOf(escrow.address)).to.be.equal(initialTotalL1Supply - withdrawAmount)
    })

    // pending withdrawals MUST success even if bridge is closed
    it('completes withdrawals even when closed', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway, l1CrossDomainMessengerMock, l2DepositedTokenMock } = await setupWithdrawTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DepositedTokenMock.address)

      await l1ERC20Gateway.close()
      await l1ERC20Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount)

      expect(await l1Dai.balanceOf(user2.address)).to.be.equal(withdrawAmount)
      expect(await l1Dai.balanceOf(escrow.address)).to.be.equal(initialTotalL1Supply - withdrawAmount)
    })

    // if bridge is closed properly this shouldn't happen
    it('reverts when escrow access was revoked', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1ERC20Gateway, l1CrossDomainMessengerMock, l2DepositedTokenMock } = await setupWithdrawTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DepositedTokenMock.address)

      await l1Dai.connect(escrow).approve(l1ERC20Gateway.address, 0)

      await expect(
        l1ERC20Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount),
      ).to.be.revertedWith(errorMessages.daiInsufficientAllowance)
    })

    it('reverts when called not by XDomainMessenger', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1ERC20Gateway, l1CrossDomainMessengerMock, l2DepositedTokenMock } = await setupWithdrawTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DepositedTokenMock.address)

      await expect(l1ERC20Gateway.connect(user2).finalizeWithdrawal(user2.address, withdrawAmount)).to.be.revertedWith(
        errorMessages.invalidMessenger,
      )
    })

    it('reverts when called by XDomainMessenger but not relying message from l2Minter', async () => {
      const [escrow, l1MessengerImpersonator, user1, user2, user3] = await ethers.getSigners()
      const { l1ERC20Gateway, l1CrossDomainMessengerMock } = await setupWithdrawTest({
        escrow,
        l1MessengerImpersonator,
        user1,
      })

      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => user3.address)

      await expect(
        l1ERC20Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount),
      ).to.be.revertedWith(errorMessages.invalidXDomainMessageOriginator)
    })
  })

  describe('close()', () => {
    it('can be called by owner', async () => {
      const [owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1ERC20Gateway } = await setupTest({
        escrow: owner,
        l1MessengerImpersonator,
        user1,
      })

      expect(await l1ERC20Gateway.isOpen()).to.be.eq(true)
      await l1ERC20Gateway.connect(owner).close()

      expect(await l1ERC20Gateway.isOpen()).to.be.eq(false)
    })

    it('can be called multiple times by the owner but nothing changes', async () => {
      const [owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1ERC20Gateway } = await setupTest({
        escrow: owner,
        l1MessengerImpersonator,
        user1,
      })

      await l1ERC20Gateway.connect(owner).close()
      expect(await l1ERC20Gateway.isOpen()).to.be.eq(false)

      await l1ERC20Gateway.connect(owner).close()
      expect(await l1ERC20Gateway.isOpen()).to.be.eq(false)
    })

    it('reverts when called not by the owner', async () => {
      const [owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1ERC20Gateway } = await setupTest({
        escrow: owner,
        l1MessengerImpersonator,
        user1,
      })

      await expect(l1ERC20Gateway.connect(user1).close()).to.be.revertedWith(errorMessages.notOwner)
    })
  })
})

async function setupTest(signers: {
  l1MessengerImpersonator: SignerWithAddress
  escrow: SignerWithAddress
  user1: SignerWithAddress
}) {
  const l2DepositedTokenMock = await deployMock('L2DepositedToken')
  const l1CrossDomainMessengerMock = await deployMock(
    'OVM_L1CrossDomainMessenger',
    { address: await signers.l1MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l1Dai = await deploy<Dai__factory>('Dai', [])
  const l1ERC20Gateway = await deploy<L1ERC20Gateway__factory>('L1ERC20Gateway', [
    l1Dai.address,
    l2DepositedTokenMock.address,
    l1CrossDomainMessengerMock.address,
    signers.escrow.address,
  ])
  await l1Dai.mint(signers.user1.address, initialTotalL1Supply)

  return { l1Dai, l1ERC20Gateway, l1CrossDomainMessengerMock, l2DepositedTokenMock }
}

async function setupWithdrawTest(signers: {
  l1MessengerImpersonator: SignerWithAddress
  escrow: SignerWithAddress
  user1: SignerWithAddress
}) {
  const contracts = await setupTest(signers)
  await contracts.l1Dai.connect(signers.escrow).approve(contracts.l1ERC20Gateway.address, ethers.constants.MaxUint256)
  await contracts.l1Dai.connect(signers.user1).transfer(await signers.escrow.getAddress(), initialTotalL1Supply)

  return contracts
}
