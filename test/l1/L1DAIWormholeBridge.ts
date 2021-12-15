import { assertPublicMutableMethods, simpleDeploy, waitForTx } from '@makerdao/hardhat-utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1DAIWormholeBridge__factory, L1Escrow__factory } from '../../typechain-types'
import { deployAbstractMock, deployMock, deployOptimismContractMock } from '../helpers'

const initialTotalL1Supply = 3000

const SOURCE_DOMAIN_NAME = ethers.utils.formatBytes32String('optimism-a')
const TARGET_DOMAIN_NAME = ethers.utils.formatBytes32String('arbitrum-a')
const AMOUNT = 100

describe('L1DAIWormholeBridge', () => {
  it('has correct public interface', async () => {
    await assertPublicMutableMethods('L1DAIWormholeBridge', [
      'finalizeFlush(bytes32,uint256)',
      'finalizeRegisterWormhole((bytes32,bytes32,address,address,uint128,uint80,uint48))',
    ])
  })

  describe('constructor', () => {
    it('assigns all variables properly', async () => {
      const [l2DAIWormholeBridge, l1CrossDomainMessenger, l1Escrow, wormholeRouter] = await ethers.getSigners()

      const l1Dai = await simpleDeploy<Dai__factory>('Dai', [])
      const l1DAITokenBridge = await simpleDeploy<L1DAIWormholeBridge__factory>('L1DAIWormholeBridge', [
        l1Dai.address,
        l2DAIWormholeBridge.address,
        l1CrossDomainMessenger.address,
        l1Escrow.address,
        wormholeRouter.address,
      ])

      expect(await l1DAITokenBridge.l1Token()).to.eq(l1Dai.address)
      expect(await l1DAITokenBridge.l2DAIWormholeBridge()).to.eq(l2DAIWormholeBridge.address)
      expect(await l1DAITokenBridge.escrow()).to.eq(l1Escrow.address)
      expect(await l1DAITokenBridge.messenger()).to.eq(l1CrossDomainMessenger.address)
      expect(await l1DAITokenBridge.wormholeRouter()).to.eq(wormholeRouter.address)
    })
  })

  describe('finalizeFlush', () => {
    it('calls the router to settle the dai debt', async () => {
      const [_, l1MessengerImpersonator, routerImpersonator, wormholeJoin] = await ethers.getSigners()
      const {
        l1Dai,
        l1DAIWormholeBridge,
        l1CrossDomainMessengerMock,
        l2DAIWormholeBridge,
        l1Escrow,
        wormholeRouterMock,
      } = await setupTest({ l1MessengerImpersonator, routerImpersonator })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAIWormholeBridge.address)

      await waitForTx(l1DAIWormholeBridge.connect(l1MessengerImpersonator).finalizeFlush(TARGET_DOMAIN_NAME, AMOUNT))
      const routerSettleCallData = wormholeRouterMock.smocked.settle.calls[0]
      await waitForTx(
        // mock DAI transfer by router
        l1Dai.connect(routerImpersonator).transferFrom(l1DAIWormholeBridge.address, wormholeJoin.address, AMOUNT),
      )

      expect(routerSettleCallData.targetDomain).to.equal(TARGET_DOMAIN_NAME)
      expect(routerSettleCallData.batchedDaiToFlush).to.equal(AMOUNT)
      expect(await l1Dai.balanceOf(l1Escrow.address)).to.eq(initialTotalL1Supply - AMOUNT)
      expect(await l1Dai.balanceOf(wormholeJoin.address)).to.eq(AMOUNT)
    })
  })

  describe('finalizeRegisterWormhole', () => {
    it('calls the router to request DAI', async () => {
      const [_, l1MessengerImpersonator, user] = await ethers.getSigners()
      const { l1DAIWormholeBridge, l1CrossDomainMessengerMock, l2DAIWormholeBridge, wormholeRouterMock } =
        await setupTest({ l1MessengerImpersonator })
      l1CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l2DAIWormholeBridge.address)
      const wormhole = {
        sourceDomain: SOURCE_DOMAIN_NAME,
        targetDomain: TARGET_DOMAIN_NAME,
        receiver: user.address,
        operator: user.address,
        amount: AMOUNT,
        nonce: 0,
        timestamp: '1639583731',
      }

      await waitForTx(l1DAIWormholeBridge.connect(l1MessengerImpersonator).finalizeRegisterWormhole(wormhole))
      const routerSettleCallData = wormholeRouterMock.smocked.requestMint.calls[0]

      expect(JSON.stringify(routerSettleCallData.wormholeGUID.map((v: any) => v.toString()))).to.equal(
        JSON.stringify(Object.values(wormhole).map((v: any) => v.toString())),
      )
      expect(routerSettleCallData.maxFee).to.equal(0)
    })
  })

  async function setupTest(signers: {
    l1MessengerImpersonator: SignerWithAddress
    routerImpersonator?: SignerWithAddress
  }) {
    const wormholeRouterMock = await deployAbstractMock('WormholeRouter', {
      address: await signers.routerImpersonator?.getAddress(),
    })
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
    await l1Dai.mint(l1Escrow.address, initialTotalL1Supply)

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
