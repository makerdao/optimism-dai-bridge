import { simpleDeploy } from '@makerdao/hardhat-utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L2DAIWormholeBridge__factory } from '../../typechain-types'
import { deployMock, deployOptimismContractMock } from '../helpers'

const INITIAL_TOTAL_L2_SUPPLY = 3000
const WORMHOLE_AMOUNT = 100
const DEFAULT_XDOMAIN_GAS = 20000
const SOURCE_DOMAIN_NAME = ethers.utils.formatBytes32String('optimism-a')
const TARGET_DOMAIN_NAME = ethers.utils.formatBytes32String('arbitrum-a')

describe('L2DAIWormholeBridge', () => {
  describe('initiateWormhole()', () => {
    it('burns DAI immediately and marks it for future flush', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Dai, l2DAIWormholeBridge } = await setupTest({ l2MessengerImpersonator, user1 })

      await l2DAIWormholeBridge
        .connect(user1)
        .initiateWormhole(TARGET_DOMAIN_NAME, user1.address, WORMHOLE_AMOUNT, user1.address)

      expect(await l2Dai.balanceOf(user1.address)).to.eq(INITIAL_TOTAL_L2_SUPPLY - WORMHOLE_AMOUNT)
      expect(await l2DAIWormholeBridge.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(WORMHOLE_AMOUNT)
    })
  })

  describe('flush()', () => {
    it('flushes batched debt', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DAIWormholeBridge, l2CrossDomainMessengerMock, l1DAIWormholeBridgeMock } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      // init two wormholes
      await l2DAIWormholeBridge
        .connect(user1)
        .initiateWormhole(TARGET_DOMAIN_NAME, user1.address, WORMHOLE_AMOUNT, user1.address)
      await l2DAIWormholeBridge
        .connect(user1)
        .initiateWormhole(TARGET_DOMAIN_NAME, user1.address, WORMHOLE_AMOUNT, user1.address)
      expect(await l2DAIWormholeBridge.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(WORMHOLE_AMOUNT * 2)

      await l2DAIWormholeBridge.flush(TARGET_DOMAIN_NAME)
      const xDomainMessengerCall = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]
      expect(await l2DAIWormholeBridge.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(0)

      expect(xDomainMessengerCall._target).to.equal(l1DAIWormholeBridgeMock.address)
      expect(xDomainMessengerCall._message).to.equal(
        l1DAIWormholeBridgeMock.interface.encodeFunctionData('finalizeFlush', [
          TARGET_DOMAIN_NAME,
          WORMHOLE_AMOUNT * 2,
        ]),
      )
      expect(xDomainMessengerCall._gasLimit).to.equal(DEFAULT_XDOMAIN_GAS)
    })
  })
})

async function setupTest(signers: { l2MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const l2CrossDomainMessengerMock = await deployOptimismContractMock(
    'OVM_L2CrossDomainMessenger',
    { address: await signers.l2MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l1Dai = await simpleDeploy<Dai__factory>('Dai', [])
  const l2Dai = await simpleDeploy<Dai__factory>('Dai', [])
  const l1DAIWormholeBridgeMock = await deployMock('L1DAIWormholeBridge')
  const l2DAIWormholeBridge = await simpleDeploy<L2DAIWormholeBridge__factory>('L2DAIWormholeBridge', [
    l2CrossDomainMessengerMock.address,
    l2Dai.address,
    l1Dai.address,
    l1DAIWormholeBridgeMock.address,
    SOURCE_DOMAIN_NAME,
  ])

  await l2Dai.rely(l2DAIWormholeBridge.address)
  await l2Dai.mint(signers.user1.address, INITIAL_TOTAL_L2_SUPPLY)

  return { l2Dai, l1DAIWormholeBridgeMock, l2CrossDomainMessengerMock, l2DAIWormholeBridge, l1Dai }
}