import { assertPublicMutableMethods, getRandomAddresses, simpleDeploy, testAuth } from '@makerdao/hardhat-utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1DAITokenBridge__factory, L1Escrow__factory } from '../../typechain'
import { deployMock, deployOptimismContractMock } from '../helpers'

const initialTotalL1Supply = 3000
const depositAmount = 100
const defaultGas = 0
const defaultData = '0x'

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageOriginator: 'OVM_XCHAIN: wrong sender of cross-domain message',
  bridgeClosed: 'L1DAITokenBridge/closed',
  notOwner: 'L1DAITokenBridge/not-authorized',
  tokenMismatch: 'L1DAITokenBridge/token-not-dai',
  notEOA: 'L1DAITokenBridge/Sender-not-EOA',
  daiInsufficientAllowance: 'Dai/insufficient-allowance',
  daiInsufficientBalance: 'Dai/insufficient-balance',
}

describe('L1DAITokenBridge', () => {
  describe('depositERC20()', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow } =
        await setupTest({
          l1MessengerImpersonator,
          user1,
        })

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, depositAmount)
      const depositTx = await l1DAITokenBridge
        .connect(user1)
        .depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGas, defaultData)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1DAITokenBridge.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2DAITokenBridge.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2DAITokenBridge.interface.encodeFunctionData('finalizeDeposit', [
          l1Dai.address,
          l2Dai.address,
          user1.address,
          user1.address,
          depositAmount,
          defaultData,
        ]),
      )
      expect(depositCallToMessengerCall._gasLimit).to.equal(defaultGas)
      await expect(depositTx)
        .to.emit(l1DAITokenBridge, 'ERC20DepositInitiated')
        .withArgs(l1Dai.address, l2Dai.address, user1.address, user1.address, depositAmount, defaultData)
    })

    it('works with custom gas and data', async () => {
      const customGas = 10
      const customData = '0x01'
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow } =
        await setupTest({
          l1MessengerImpersonator,
          user1,
        })

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, depositAmount)
      const depositTx = await l1DAITokenBridge
        .connect(user1)
        .depositERC20(l1Dai.address, l2Dai.address, depositAmount, customGas, customData)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1DAITokenBridge.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2DAITokenBridge.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2DAITokenBridge.interface.encodeFunctionData('finalizeDeposit', [
          l1Dai.address,
          l2Dai.address,
          user1.address,
          user1.address,
          depositAmount,
          customData,
        ]),
      )
      expect(depositCallToMessengerCall._gasLimit).to.equal(customGas)
      await expect(depositTx)
        .to.emit(l1DAITokenBridge, 'ERC20DepositInitiated')
        .withArgs(l1Dai.address, l2Dai.address, user1.address, user1.address, depositAmount, customData)
    })

    it('reverts when called with a different token', async () => {
      const [l1MessengerImpersonator, user1, dummyL1Erc20, dummyL2Erc20] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20(dummyL1Erc20.address, l2Dai.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.tokenMismatch)
      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20(l1Dai.address, dummyL2Erc20.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.tokenMismatch)
    })

    it('reverts when called not by EOA', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await expect(
        l1DAITokenBridge
          .connect(l1MessengerImpersonator) // pretend to be a contract, messenger in this case
          .depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.notEOA)
    })

    it('reverts when approval is too low', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, 0)
      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientAllowance)
    })

    it('reverts when funds too low', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user2).approve(l1DAITokenBridge.address, depositAmount)
      await expect(
        l1DAITokenBridge
          .connect(user2)
          .depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientBalance)
    })

    it('reverts when bridge is closed', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1DAITokenBridge.close()

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, depositAmount)

      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.bridgeClosed)
    })
  })

  describe('depositERC20To()', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow, l2Dai } =
        await setupTest({
          l1MessengerImpersonator,
          user1,
        })

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, depositAmount)
      const depositTx = await l1DAITokenBridge
        .connect(user1)
        .depositERC20To(l1Dai.address, l2Dai.address, user2.address, depositAmount, defaultGas, defaultData)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1DAITokenBridge.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2DAITokenBridge.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2DAITokenBridge.interface.encodeFunctionData('finalizeDeposit', [
          l1Dai.address,
          l2Dai.address,
          user1.address,
          user2.address,
          depositAmount,
          defaultData,
        ]),
      )
      expect(depositCallToMessengerCall._gasLimit).to.equal(defaultGas)
      await expect(depositTx)
        .to.emit(l1DAITokenBridge, 'ERC20DepositInitiated')
        .withArgs(l1Dai.address, l2Dai.address, user1.address, user2.address, depositAmount, defaultData)
    })

    it('works with custom gas and data', async () => {
      const customGas = 10
      const customData = '0x01'
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow, l2Dai } =
        await setupTest({
          l1MessengerImpersonator,
          user1,
        })

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, depositAmount)
      const depositTx = await l1DAITokenBridge
        .connect(user1)
        .depositERC20To(l1Dai.address, l2Dai.address, user2.address, depositAmount, customGas, customData)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(initialTotalL1Supply - depositAmount)
      expect(await l1Dai.balanceOf(l1DAITokenBridge.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2DAITokenBridge.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2DAITokenBridge.interface.encodeFunctionData('finalizeDeposit', [
          l1Dai.address,
          l2Dai.address,
          user1.address,
          user2.address,
          depositAmount,
          customData,
        ]),
      )
      expect(depositCallToMessengerCall._gasLimit).to.equal(customGas)
      await expect(depositTx)
        .to.emit(l1DAITokenBridge, 'ERC20DepositInitiated')
        .withArgs(l1Dai.address, l2Dai.address, user1.address, user2.address, depositAmount, customData)
    })

    it('reverts when called with a different token', async () => {
      const [l1MessengerImpersonator, user1, user2, dummyL1Erc20, dummyL2Erc20] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20To(dummyL1Erc20.address, l2Dai.address, user2.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.tokenMismatch)
      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20To(l1Dai.address, dummyL2Erc20.address, user2.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.tokenMismatch)
    })

    it('reverts when approval is too low', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, 0)
      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20To(l1Dai.address, l2Dai.address, user2.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientAllowance)
    })

    it('reverts when funds too low', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1Dai.connect(user2).approve(l1DAITokenBridge.address, depositAmount)
      await expect(
        l1DAITokenBridge
          .connect(user2)
          .depositERC20To(l1Dai.address, l2Dai.address, user1.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.daiInsufficientBalance)
    })

    it('reverts when bridge is closed', async () => {
      const [l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1DAITokenBridge.close()

      await l1Dai.connect(user1).approve(l1DAITokenBridge.address, depositAmount)

      await expect(
        l1DAITokenBridge
          .connect(user1)
          .depositERC20To(l1Dai.address, l2Dai.address, user1.address, depositAmount, defaultGas, defaultData),
      ).to.be.revertedWith(errorMessages.bridgeClosed)
    })
  })

  describe('finalizeERC20Withdrawal', () => {
    const withdrawAmount = 100

    it('sends funds from the escrow', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow } =
        await setupWithdrawTest({
          l1MessengerImpersonator,
          user1,
        })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAITokenBridge.address)

      const finalizeWithdrawalTx = await l1DAITokenBridge
        .connect(l1MessengerImpersonator)
        .finalizeERC20Withdrawal(
          l1Dai.address,
          l2Dai.address,
          user2.address,
          user2.address,
          withdrawAmount,
          defaultData,
        )

      expect(await l1Dai.balanceOf(user2.address)).to.be.equal(withdrawAmount)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.equal(initialTotalL1Supply - withdrawAmount)
      await expect(finalizeWithdrawalTx)
        .to.emit(l1DAITokenBridge, 'ERC20WithdrawalFinalized')
        .withArgs(l1Dai.address, l2Dai.address, user2.address, user2.address, depositAmount, defaultData)
    })

    it('sends funds from the escrow to the 3rd party', async () => {
      const [l1MessengerImpersonator, user1, sender, receiver] = await ethers.getSigners()
      const { l1Dai, l1DAITokenBridge, l2Dai, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow } =
        await setupWithdrawTest({
          l1MessengerImpersonator,
          user1,
        })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAITokenBridge.address)

      const finalizeWithdrawalTx = await l1DAITokenBridge
        .connect(l1MessengerImpersonator)
        .finalizeERC20Withdrawal(
          l1Dai.address,
          l2Dai.address,
          sender.address,
          receiver.address,
          withdrawAmount,
          defaultData,
        )

      expect(await l1Dai.balanceOf(sender.address)).to.be.equal(0)
      expect(await l1Dai.balanceOf(receiver.address)).to.be.equal(withdrawAmount)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.equal(initialTotalL1Supply - withdrawAmount)
      await expect(finalizeWithdrawalTx)
        .to.emit(l1DAITokenBridge, 'ERC20WithdrawalFinalized')
        .withArgs(l1Dai.address, l2Dai.address, sender.address, receiver.address, depositAmount, defaultData)
    })

    // pending withdrawals MUST success even if bridge is closed
    it('completes withdrawals even when closed', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow } =
        await setupWithdrawTest({
          l1MessengerImpersonator,
          user1,
        })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAITokenBridge.address)

      await l1DAITokenBridge.close()
      const finalizeWithdrawalTx = await l1DAITokenBridge
        .connect(l1MessengerImpersonator)
        .finalizeERC20Withdrawal(
          l1Dai.address,
          l2Dai.address,
          user2.address,
          user2.address,
          withdrawAmount,
          defaultData,
        )

      expect(await l1Dai.balanceOf(user2.address)).to.be.equal(withdrawAmount)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.be.equal(initialTotalL1Supply - withdrawAmount)
      await expect(finalizeWithdrawalTx)
        .to.emit(l1DAITokenBridge, 'ERC20WithdrawalFinalized')
        .withArgs(l1Dai.address, l2Dai.address, user2.address, user2.address, depositAmount, defaultData)
    })

    it('reverts when called with a different token', async () => {
      const [l1MessengerImpersonator, user1, dummyL1Erc20, dummyL2Erc20] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAITokenBridge.address)

      await expect(
        l1DAITokenBridge
          .connect(l1MessengerImpersonator)
          .finalizeERC20Withdrawal(
            dummyL1Erc20.address,
            l2Dai.address,
            user1.address,
            user1.address,
            depositAmount,
            defaultData,
          ),
      ).to.be.revertedWith(errorMessages.tokenMismatch)
      await expect(
        l1DAITokenBridge
          .connect(l1MessengerImpersonator)
          .finalizeERC20Withdrawal(
            l1Dai.address,
            dummyL2Erc20.address,
            user1.address,
            user1.address,
            depositAmount,
            defaultData,
          ),
      ).to.be.revertedWith(errorMessages.tokenMismatch)
    })

    // if bridge is closed properly this shouldn't happen
    it('reverts when escrow access was revoked', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1Dai, l2Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow } =
        await setupWithdrawTest({
          l1MessengerImpersonator,
          user1,
        })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAITokenBridge.address)

      await l1Escrow.approve(l1Dai.address, l1DAITokenBridge.address, 0)

      await expect(
        l1DAITokenBridge
          .connect(l1MessengerImpersonator)
          .finalizeERC20Withdrawal(
            l1Dai.address,
            l2Dai.address,
            user2.address,
            user2.address,
            withdrawAmount,
            defaultData,
          ),
      ).to.be.revertedWith(errorMessages.daiInsufficientAllowance)
    })

    it('reverts when called not by XDomainMessenger', async () => {
      const [l1MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Dai, l2Dai } = await setupWithdrawTest({
        l1MessengerImpersonator,
        user1,
      })

      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAITokenBridge.address)

      await expect(
        l1DAITokenBridge
          .connect(user2)
          .finalizeERC20Withdrawal(
            l1Dai.address,
            l2Dai.address,
            user2.address,
            user2.address,
            withdrawAmount,
            defaultData,
          ),
      ).to.be.revertedWith(errorMessages.invalidMessenger)
    })

    it('reverts when called by XDomainMessenger but not relying message from l2DAITokenBridge', async () => {
      const [l1MessengerImpersonator, user1, user2, user3] = await ethers.getSigners()
      const { l1DAITokenBridge, l1CrossDomainMessengerMock, l1Dai, l2Dai } = await setupWithdrawTest({
        l1MessengerImpersonator,
        user1,
      })

      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => user3.address)

      await expect(
        l1DAITokenBridge
          .connect(l1MessengerImpersonator)
          .finalizeERC20Withdrawal(
            l1Dai.address,
            l2Dai.address,
            user2.address,
            user2.address,
            withdrawAmount,
            defaultData,
          ),
      ).to.be.revertedWith(errorMessages.invalidXDomainMessageOriginator)
    })
  })

  describe('close()', () => {
    it('can be called by owner', async () => {
      const [owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1DAITokenBridge } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      expect(await l1DAITokenBridge.isOpen()).to.be.eq(1)
      const closeTx = await l1DAITokenBridge.connect(owner).close()

      await expect(closeTx).to.emit(l1DAITokenBridge, 'Closed')

      expect(await l1DAITokenBridge.isOpen()).to.be.eq(0)
    })

    it('can be called multiple times by the owner but nothing changes', async () => {
      const [owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1DAITokenBridge } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await l1DAITokenBridge.connect(owner).close()
      expect(await l1DAITokenBridge.isOpen()).to.be.eq(0)

      await l1DAITokenBridge.connect(owner).close()
      expect(await l1DAITokenBridge.isOpen()).to.be.eq(0)
    })

    it('reverts when called not by the owner', async () => {
      const [_owner, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1DAITokenBridge } = await setupTest({
        l1MessengerImpersonator,
        user1,
      })

      await expect(l1DAITokenBridge.connect(user1).close()).to.be.revertedWith(errorMessages.notOwner)
    })
  })

  describe('constructor', () => {
    it('assigns all variables properly', async () => {
      const [l1Dai, l2DAITokenBridgeMock, l2Dai, l1CrossDomainMessenger, l1Escrow] = await ethers.getSigners()

      const l1DAITokenBridge = await simpleDeploy<L1DAITokenBridge__factory>('L1DAITokenBridge', [
        l1Dai.address,
        l2DAITokenBridgeMock.address,
        l2Dai.address,
        l1CrossDomainMessenger.address,
        l1Escrow.address,
      ])

      expect(await l1DAITokenBridge.l1Token()).to.eq(l1Dai.address)
      expect(await l1DAITokenBridge.l2Token()).to.eq(l2Dai.address)
      expect(await l1DAITokenBridge.l2DAITokenBridge()).to.eq(l2DAITokenBridgeMock.address)
      expect(await l1DAITokenBridge.escrow()).to.eq(l1Escrow.address)
      expect(await l1DAITokenBridge.messenger()).to.eq(l1CrossDomainMessenger.address)
    })
  })

  it('has correct public interface', async () => {
    await assertPublicMutableMethods('L1DAITokenBridge', [
      'rely(address)',
      'deny(address)',
      'close()',
      'depositERC20(address,address,uint256,uint32,bytes)',
      'depositERC20To(address,address,address,uint256,uint32,bytes)',
      'finalizeERC20Withdrawal(address,address,address,address,uint256,bytes)',
    ])
  })

  testAuth({
    name: 'L1DAITokenBridge',
    getDeployArgs: async () => {
      const [l1Dai, l2DAITokenBridge, l2Dai, l1CrossDomainMessengerMock, l1Escrow] = await getRandomAddresses()

      return [l1Dai, l2DAITokenBridge, l2Dai, l1CrossDomainMessengerMock, l1Escrow]
    },
    authedMethods: [(c) => c.close()],
  })
})

async function setupTest(signers: { l1MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const l2DAITokenBridge = await deployMock('L2DAITokenBridge')
  const l1CrossDomainMessengerMock = await deployOptimismContractMock(
    'OVM_L1CrossDomainMessenger',
    { address: await signers.l1MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l1Dai = await simpleDeploy<Dai__factory>('Dai', [])
  const l2Dai = await simpleDeploy<Dai__factory>('Dai', [])
  const l1Escrow = await simpleDeploy<L1Escrow__factory>('L1Escrow', [])
  const l1DAITokenBridge = await simpleDeploy<L1DAITokenBridge__factory>('L1DAITokenBridge', [
    l1Dai.address,
    l2DAITokenBridge.address,
    l2Dai.address,
    l1CrossDomainMessengerMock.address,
    l1Escrow.address,
  ])
  await l1Dai.mint(signers.user1.address, initialTotalL1Supply)

  return { l1Dai, l2Dai, l1DAITokenBridge, l1CrossDomainMessengerMock, l2DAITokenBridge, l1Escrow }
}

async function setupWithdrawTest(signers: { l1MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const contracts = await setupTest(signers)
  await contracts.l1Escrow.approve(
    contracts.l1Dai.address,
    contracts.l1DAITokenBridge.address,
    ethers.constants.MaxUint256,
  )
  await contracts.l1Dai.connect(signers.user1).transfer(contracts.l1Escrow.address, initialTotalL1Supply)

  return contracts
}
