import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { ZERO_GAS_OPTS } from '../../test-e2e/helpers/utils'

import { Dai__factory, L1Escrow__factory, L1Gateway__factory } from '../../typechain'
import { deploy, deployMock, deployOptimismContractMock } from '../helpers'

const initialTotalL1Supply = 3000
const depositAmount = 100

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageOriginator: 'OVM_XCHAIN: wrong sender of cross-domain message',
  bridgeClosed: 'L1Gateway/closed',
  notOwner: 'L1Gateway/not-authorized',
  daiInsufficientAllowance: 'Dai/insufficient-allowance',
  daiInsufficientBalance: 'Dai/insufficient-balance',
}

describe.only('L1Gateway', () => {
  describe('depositERC20()', () => {
    it.only('escrows funds and sends xchain message on deposit', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1Gateway, l1CrossDomainMessengerMock, l2GatewayMock, l1Escrow } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1Gateway.address, depositAmount)
      await l1Gateway.connect(user1).depositERC20(l1Dai.address, l2GatewayMock.address, depositAmount, 0, '0x')
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1Gateway.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2GatewayMock.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2GatewayMock.interface.encodeFunctionData('finalizeDeposit', [
          l1Dai.address,
          l2Dai.address,
          user1.address,
          user1.address,
          depositAmount,
          '0x',
        ]),
      )
      //@todo assert event
    })

    it('reverts when approval is too low', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1Gateway.address, 0)
      await expect(l1Gateway.connect(user1).deposit(depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientAllowance,
      )
    })

    it('reverts when funds too low', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user2).approve(l1Gateway.address, depositAmount)
      await expect(l1Gateway.connect(user2).deposit(depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientBalance,
      )
    })

    it('reverts when bridge is closed', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Gateway.close()

      await l1Dai.connect(user1).approve(l1Gateway.address, depositAmount)

      await expect(l1Gateway.connect(user1).deposit(depositAmount)).to.be.revertedWith(errorMessages.bridgeClosed)
    })
  })

  describe('depositTo()', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Gateway, l1CrossDomainMessengerMock, l2GatewayMock, l1Escrow } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1Gateway.address, depositAmount)
      await l1Gateway.connect(user1).depositTo(user2.address, depositAmount)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1Gateway.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2GatewayMock.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2GatewayMock.interface.encodeFunctionData('finalizeDeposit', [user2.address, depositAmount]),
      )
    })

    it('reverts when approval is too low', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1Gateway.address, 0)
      await expect(l1Gateway.connect(user1).depositTo(user2.address, depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientAllowance,
      )
    })

    it('reverts when funds too low', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user2).approve(l1Gateway.address, depositAmount)
      await expect(l1Gateway.connect(user2).depositTo(user1.address, depositAmount)).to.be.revertedWith(
        errorMessages.daiInsufficientBalance,
      )
    })

    it('reverts when bridge is closed', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Gateway.close()

      await l1Dai.connect(user1).approve(l1Gateway.address, depositAmount)

      await expect(l1Gateway.connect(user1).depositTo(user1.address, depositAmount)).to.be.revertedWith(
        errorMessages.bridgeClosed,
      )
    })
  })

  describe('finalizeWithdrawal', () => {
    const withdrawAmount = 100

    it('sends funds from the escrow', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Gateway, l1CrossDomainMessengerMock, l2GatewayMock, l1Escrow } = await setupWithdrawTest({
        l1MessengerImpersonator,
        user1,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2GatewayMock.address)

      await l1Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount)

      expect(await l1Dai.balanceOf(user2.address)).to.be.equal(withdrawAmount)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.equal(initialTotalL1Supply - withdrawAmount)
    })

    // pending withdrawals MUST success even if bridge is closed
    it('completes withdrawals even when closed', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Gateway, l1CrossDomainMessengerMock, l2GatewayMock, l1Escrow } = await setupWithdrawTest({
        l1MessengerImpersonator,
        user1,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2GatewayMock.address)

      await l1Gateway.close()
      await l1Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount)

      expect(await l1Dai.balanceOf(user2.address)).to.be.equal(withdrawAmount)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.equal(initialTotalL1Supply - withdrawAmount)
    })

    // if bridge is closed properly this shouldn't happen
    it('reverts when escrow access was revoked', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1Gateway, l1CrossDomainMessengerMock, l2GatewayMock, l1Escrow } = await setupWithdrawTest({
        l1MessengerImpersonator,
        user1,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2GatewayMock.address)

      await l1Escrow.approve(l1Dai.address, l1Gateway.address, 0)

      await expect(
        l1Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount),
      ).to.be.revertedWith(errorMessages.daiInsufficientAllowance)
    })

    it('reverts when called not by XDomainMessenger', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Gateway, l1CrossDomainMessengerMock, l2GatewayMock } = await setupWithdrawTest({
        l1MessengerImpersonator,
        user1,
      })

      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2GatewayMock.address)

      await expect(l1Gateway.connect(user2).finalizeWithdrawal(user2.address, withdrawAmount)).to.be.revertedWith(
        errorMessages.invalidMessenger,
      )
    })

    it('reverts when called by XDomainMessenger but not relying message from l2Gateway', async () => {
      const [l1MessengerImpersonator, user1, user2, user3] = await ethers.getSigners()
      const { l1Gateway, l1CrossDomainMessengerMock } = await setupWithdrawTest({
        l1MessengerImpersonator,
        user1,
      })

      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => user3.address)

      await expect(
        l1Gateway.connect(l1MessengerImpersonator).finalizeWithdrawal(user2.address, withdrawAmount),
      ).to.be.revertedWith(errorMessages.invalidXDomainMessageOriginator)
    })
  })

  describe('close()', () => {
    it('can be called by owner', async () => {
      const [owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      expect(await l1Gateway.isOpen()).to.be.eq(1)
      await l1Gateway.connect(owner).close()

      expect(await l1Gateway.isOpen()).to.be.eq(0)
    })

    it('can be called multiple times by the owner but nothing changes', async () => {
      const [owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Gateway.connect(owner).close()
      expect(await l1Gateway.isOpen()).to.be.eq(0)

      await l1Gateway.connect(owner).close()
      expect(await l1Gateway.isOpen()).to.be.eq(0)
    })

    it('reverts when called not by the owner', async () => {
      const [_owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Gateway } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await expect(l1Gateway.connect(user1).close()).to.be.revertedWith(errorMessages.notOwner)
    })
  })
})

async function setupTest(signers: { l1MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const l2GatewayMock = await deployMock('L2Gateway')
  const l1CrossDomainMessengerMock = await deployOptimismContractMock(
    'OVM_L1CrossDomainMessenger',
    { address: await signers.l1MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l1Dai = await deploy<Dai__factory>('Dai')
  const l2Dai = await deploy<Dai__factory>('Dai')
  const l1Escrow = await deploy<L1Escrow__factory>('L1Escrow')
  const l1Gateway = await deploy<L1Gateway__factory>('L1Gateway', [
    l1Dai.address,
    l2GatewayMock.address,
    l2Dai.address,
    l1CrossDomainMessengerMock.address,
    l1Escrow.address,
  ])
  await l1Dai.mint(signers.user1.address, initialTotalL1Supply)

  return { l1Dai, l2Dai, l1Gateway, l1CrossDomainMessengerMock, l2GatewayMock, l1Escrow }
}

async function setupWithdrawTest(signers: { l1MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const contracts = await setupTest(signers)
  await contracts.l1Escrow.approve(contracts.l1Dai.address, contracts.l1Gateway.address, ethers.constants.MaxUint256)
  await contracts.l1Dai.connect(signers.user1).transfer(contracts.l1Escrow.address, initialTotalL1Supply)

  return contracts
}
