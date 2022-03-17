import { assertPublicMutableMethods, getRandomAddress, simpleDeploy, waitForTx } from '@makerdao/hardhat-utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1DAIWormholeBridge__factory, L1Escrow__factory } from '../../typechain-types'
import { WormholeGUIDStruct } from '../../typechain-types/L1DAIWormholeBridge'
import { addressToBytes32, deployAbstractMock, deployMock, deployOptimismContractMock } from '../helpers'

const INITIAL_ESCROW_BALANCE = 3000
const SOURCE_DOMAIN_NAME = ethers.utils.formatBytes32String('optimism-a')
const TARGET_DOMAIN_NAME = ethers.utils.formatBytes32String('arbitrum-a')
const AMOUNT = 100

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageOriginator: 'OVM_XCHAIN: wrong sender of cross-domain message',
}

describe('L1DAIWormholeBridge', () => {
  it('has correct public interface', async () => {
    await assertPublicMutableMethods('L1DAIWormholeBridge', [
      'finalizeFlush(bytes32,uint256)',
      'finalizeRegisterWormhole((bytes32,bytes32,bytes32,bytes32,uint128,uint80,uint48))',
    ])
  })

  describe('constructor', () => {
    it('sets all variables and approvals properly', async () => {
      const [l2DAIWormholeBridge, l1CrossDomainMessenger, l1Escrow, wormholeRouter] = await ethers.getSigners()

      const l1Dai = await simpleDeploy<Dai__factory>('Dai', [])
      const l1DAITokenBridge = await simpleDeploy<L1DAIWormholeBridge__factory>('L1DAIWormholeBridge', [
        l1Dai.address,
        l2DAIWormholeBridge.address,
        l1CrossDomainMessenger.address,
        l1Escrow.address,
        wormholeRouter.address,
      ])

      // Check that all variables have been assigned correctly
      expect(await l1DAITokenBridge.l1Token()).to.eq(l1Dai.address)
      expect(await l1DAITokenBridge.l2WormholeBridge()).to.eq(l2DAIWormholeBridge.address)
      expect(await l1DAITokenBridge.l1Escrow()).to.eq(l1Escrow.address)
      expect(await l1DAITokenBridge.messenger()).to.eq(l1CrossDomainMessenger.address)
      expect(await l1DAITokenBridge.l1WormholeRouter()).to.eq(wormholeRouter.address)
      // Check that the wormholeRouter has been given infinite approval
      expect(await l1Dai.allowance(l1DAITokenBridge.address, wormholeRouter.address)).to.eq(ethers.constants.MaxUint256)
    })
  })

  describe('finalizeFlush', () => {
    it('calls the router to settle the dai debt', async () => {
      const [_, l1MessengerImpersonator] = await ethers.getSigners()
      const {
        l1Dai,
        l1DAIWormholeBridge,
        l1CrossDomainMessengerMock,
        l2DAIWormholeBridge,
        l1Escrow,
        wormholeRouterMock,
      } = await setupTest({ l1MessengerImpersonator })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAIWormholeBridge.address)

      await waitForTx(l1DAIWormholeBridge.connect(l1MessengerImpersonator).finalizeFlush(TARGET_DOMAIN_NAME, AMOUNT))
      const routerSettleCallData = wormholeRouterMock.smocked.settle.calls[0]

      expect(routerSettleCallData.targetDomain).to.equal(TARGET_DOMAIN_NAME)
      expect(routerSettleCallData.batchedDaiToFlush).to.equal(AMOUNT)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.eq(INITIAL_ESCROW_BALANCE - AMOUNT)
    })

    it('reverts when not called by XDomainMessenger', async () => {
      const [l1MessengerImpersonator, user] = await ethers.getSigners()
      const { l1DAIWormholeBridge, l1CrossDomainMessengerMock, l2DAIWormholeBridge } = await setupTest({
        l1MessengerImpersonator,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAIWormholeBridge.address)

      await expect(l1DAIWormholeBridge.connect(user).finalizeFlush(TARGET_DOMAIN_NAME, AMOUNT)).to.be.revertedWith(
        errorMessages.invalidMessenger,
      )
    })

    it('reverts when called by XDomainMessenger but not relaying a message from l2DAIWormholeBridge', async () => {
      const [l1MessengerImpersonator, user] = await ethers.getSigners()
      const { l1DAIWormholeBridge, l1CrossDomainMessengerMock } = await setupTest({
        l1MessengerImpersonator,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => user.address)

      await expect(
        l1DAIWormholeBridge.connect(l1MessengerImpersonator).finalizeFlush(TARGET_DOMAIN_NAME, AMOUNT),
      ).to.be.revertedWith(errorMessages.invalidXDomainMessageOriginator)
    })
  })

  describe('finalizeRegisterWormhole', () => {
    let wormhole: WormholeGUIDStruct
    beforeEach(async () => {
      const receiver = await getRandomAddress()
      wormhole = {
        sourceDomain: SOURCE_DOMAIN_NAME,
        targetDomain: TARGET_DOMAIN_NAME,
        receiver: addressToBytes32(receiver),
        operator: addressToBytes32(receiver),
        amount: AMOUNT,
        nonce: 0,
        timestamp: '1639583731',
      }
    })

    it('calls the router to request DAI', async () => {
      const [l1MessengerImpersonator] = await ethers.getSigners()
      const { l1DAIWormholeBridge, l1CrossDomainMessengerMock, l2DAIWormholeBridge, wormholeRouterMock } =
        await setupTest({ l1MessengerImpersonator })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAIWormholeBridge.address)

      await waitForTx(l1DAIWormholeBridge.connect(l1MessengerImpersonator).finalizeRegisterWormhole(wormhole))
      const routerSettleCallData = wormholeRouterMock.smocked.requestMint.calls[0]

      expect(JSON.stringify(routerSettleCallData.wormholeGUID.map((v: any) => v.toString()))).to.equal(
        JSON.stringify(Object.values(wormhole).map((v: any) => v.toString())),
      )
      expect(routerSettleCallData.maxFeePercentage).to.equal(0)
      expect(routerSettleCallData.operatorFee).to.equal(0)
    })

    it('reverts when not called by XDomainMessenger', async () => {
      const [l1MessengerImpersonator, user] = await ethers.getSigners()
      const { l1DAIWormholeBridge, l1CrossDomainMessengerMock, l2DAIWormholeBridge } = await setupTest({
        l1MessengerImpersonator,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAIWormholeBridge.address)

      await expect(l1DAIWormholeBridge.connect(user).finalizeRegisterWormhole(wormhole)).to.be.revertedWith(
        errorMessages.invalidMessenger,
      )
    })

    it('reverts when called by XDomainMessenger but not relaying a message from l2DAIWormholeBridge', async () => {
      const [l1MessengerImpersonator, user] = await ethers.getSigners()
      const { l1DAIWormholeBridge, l1CrossDomainMessengerMock } = await setupTest({
        l1MessengerImpersonator,
      })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => user.address)

      await expect(
        l1DAIWormholeBridge.connect(l1MessengerImpersonator).finalizeRegisterWormhole(wormhole),
      ).to.be.revertedWith(errorMessages.invalidXDomainMessageOriginator)
    })
  })

  async function setupTest(signers: { l1MessengerImpersonator: SignerWithAddress }) {
    const wormholeRouterMock = await deployAbstractMock('IL1WormholeRouter')
    const l2DAIWormholeBridge = await deployMock('L2DAIWormholeBridge')
    const l1CrossDomainMessengerMock = await deployOptimismContractMock(
      'OVM_L1CrossDomainMessenger',
      { address: await signers.l1MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
    )
    const l1Dai = await simpleDeploy<Dai__factory>('Dai', [])
    const l1Escrow = await simpleDeploy<L1Escrow__factory>('L1Escrow', [])
    const l1DAIWormholeBridge = await simpleDeploy<L1DAIWormholeBridge__factory>('L1DAIWormholeBridge', [
      l1Dai.address,
      l2DAIWormholeBridge.address,
      l1CrossDomainMessengerMock.address,
      l1Escrow.address,
      wormholeRouterMock.address,
    ])
    await l1Escrow.approve(l1Dai.address, l1DAIWormholeBridge.address, ethers.constants.MaxUint256)
    await l1Dai.mint(l1Escrow.address, INITIAL_ESCROW_BALANCE)

    return {
      l1Dai,
      l1DAIWormholeBridge,
      l1CrossDomainMessengerMock,
      l2DAIWormholeBridge,
      l1Escrow,
      wormholeRouterMock,
    }
  }
})
