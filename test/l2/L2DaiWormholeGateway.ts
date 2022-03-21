import { assertPublicMutableMethods, getRandomAddresses, simpleDeploy, testAuth } from '@makerdao/hardhat-utils'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L2DaiWormholeGateway__factory } from '../../typechain-types'
import { addressToBytes32, deployMock, deployOptimismContractMock } from '../helpers'

const INITIAL_L2_DAI_SUPPLY = 3000
const WORMHOLE_AMOUNT = 100
const FILE_VALID_DOMAINS = ethers.utils.formatBytes32String('validDomains')
const SOURCE_DOMAIN_NAME = ethers.utils.formatBytes32String('optimism-a')
const TARGET_DOMAIN_NAME = ethers.utils.formatBytes32String('arbitrum-a')
const INVALID_DOMAIN_NAME = ethers.utils.formatBytes32String('invalid-domain')

const errorMessages = {
  daiInsufficientBalance: 'Dai/insufficient-balance',
  notOwner: 'L2DaiWormholeGateway/not-authorized',
  bridgeClosed: 'L2DaiWormholeGateway/closed',
  zeroDaiFlush: 'L2DaiWormholeGateway/zero-dai-flush',
  invalidDomain: 'L2DaiWormholeGateway/invalid-domain',
  unrecognizedParam: 'L2DaiWormholeGateway/file-unrecognized-param',
  invalidData: 'L2DaiWormholeGateway/invalid-data',
}

describe('L2DaiWormholeGateway', () => {
  it('has correct public interface', async () => {
    await assertPublicMutableMethods('L2DaiWormholeGateway', [
      'rely(address)',
      'deny(address)',
      'close()',
      'file(bytes32,bytes32,uint256)',
      'initiateWormhole(bytes32,address,uint128)',
      'initiateWormhole(bytes32,address,uint128,address)',
      'initiateWormhole(bytes32,bytes32,uint128,bytes32)',
      'flush(bytes32)',
    ])
  })

  describe('constructor', () => {
    it('assigns all variables properly', async () => {
      const [l2Messenger, l2Dai, l1DaiWormholeGateway] = await ethers.getSigners()

      const l2DaiWormholeGateway = await simpleDeploy<L2DaiWormholeGateway__factory>('L2DaiWormholeGateway', [
        l2Messenger.address,
        l2Dai.address,
        l1DaiWormholeGateway.address,
        SOURCE_DOMAIN_NAME,
      ])

      expect(await l2DaiWormholeGateway.messenger()).to.eq(l2Messenger.address)
      expect(await l2DaiWormholeGateway.l2Token()).to.eq(l2Dai.address)
      expect(await l2DaiWormholeGateway.l1WormholeGateway()).to.eq(l1DaiWormholeGateway.address)
    })
  })

  testAuth({
    name: 'L2DaiWormholeGateway',
    getDeployArgs: async () => {
      const [l2Messenger, l2Dai, l1DaiWormholeGateway] = await getRandomAddresses()
      return [l2Messenger, l2Dai, l1DaiWormholeGateway, SOURCE_DOMAIN_NAME]
    },
    authedMethods: [(c) => c.close(), (c) => c.file(FILE_VALID_DOMAINS, TARGET_DOMAIN_NAME, 1)],
  })

  describe('file', () => {
    it('disallows invalid "what"', async () => {
      const [l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      await expect(
        l2DaiWormholeGateway.file(ethers.utils.formatBytes32String('invalid'), TARGET_DOMAIN_NAME, 1),
      ).to.be.revertedWith(errorMessages.unrecognizedParam)
    })
    it('disallows invalid data for "validDomains"', async () => {
      const [l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      await expect(l2DaiWormholeGateway.file(FILE_VALID_DOMAINS, TARGET_DOMAIN_NAME, 666)).to.be.revertedWith(
        errorMessages.invalidData,
      )
    })
  })

  describe('close()', () => {
    it('can be called by owner', async () => {
      const [owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      expect(await l2DaiWormholeGateway.isOpen()).to.be.eq(1)
      const closeTx = await l2DaiWormholeGateway.connect(owner).close()
      await expect(closeTx).to.emit(l2DaiWormholeGateway, 'Closed')
      expect(await l2DaiWormholeGateway.isOpen()).to.be.eq(0)
    })
    it('can be called multiple times by the owner but nothing changes', async () => {
      const [owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2DaiWormholeGateway.connect(owner).close()
      expect(await l2DaiWormholeGateway.isOpen()).to.be.eq(0)
      await l2DaiWormholeGateway.connect(owner).close()
      expect(await l2DaiWormholeGateway.isOpen()).to.be.eq(0)
    })
    it('reverts when called not by the owner', async () => {
      const [_owner, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      await expect(l2DaiWormholeGateway.connect(user1).close()).to.be.revertedWith(errorMessages.notOwner)
    })
  })

  describe('initiateWormhole(bytes32,address,uint128,address)', () => {
    it('sends xchain message, burns DAI and marks it for future flush', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Dai, l2DaiWormholeGateway, l1DAIWormholeBridgeMock, l2CrossDomainMessengerMock } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      const l2MessengerNonce = await l2CrossDomainMessengerMock.messageNonce()

      const initTx = await l2DaiWormholeGateway
        .connect(user1)
        ['initiateWormhole(bytes32,address,uint128,address)'](
          TARGET_DOMAIN_NAME,
          user1.address,
          WORMHOLE_AMOUNT,
          user1.address,
        )
      const l2MessengerSendMessageCallData = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      const wormhole = {
        sourceDomain: SOURCE_DOMAIN_NAME,
        targetDomain: TARGET_DOMAIN_NAME,
        receiver: addressToBytes32(user1.address),
        operator: addressToBytes32(user1.address),
        amount: WORMHOLE_AMOUNT,
        nonce: l2MessengerNonce,
        timestamp: (await ethers.provider.getBlock(initTx.blockNumber as any)).timestamp,
      }
      expect(await l2Dai.balanceOf(user1.address)).to.eq(INITIAL_L2_DAI_SUPPLY - WORMHOLE_AMOUNT)
      expect(await l2Dai.totalSupply()).to.equal(INITIAL_L2_DAI_SUPPLY - WORMHOLE_AMOUNT)
      expect(await l2DaiWormholeGateway.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(WORMHOLE_AMOUNT)
      expect(l2MessengerSendMessageCallData._target).to.equal(l1DAIWormholeBridgeMock.address)
      expect(l2MessengerSendMessageCallData._message).to.equal(
        l1DAIWormholeBridgeMock.interface.encodeFunctionData('finalizeRegisterWormhole', [wormhole]),
      )
      await expect(initTx).to.emit(l2DaiWormholeGateway, 'WormholeInitialized').withArgs(Object.values(wormhole))
    })

    it('reverts when not enough funds', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      await expect(
        l2DaiWormholeGateway
          .connect(user2)
          ['initiateWormhole(bytes32,address,uint128,address)'](
            TARGET_DOMAIN_NAME,
            user2.address,
            WORMHOLE_AMOUNT,
            user2.address,
          ),
      ).to.be.revertedWith(errorMessages.daiInsufficientBalance)
    })

    it('reverts when bridge is closed', async () => {
      const [owner, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      await l2DaiWormholeGateway.connect(owner).close()

      await expect(
        l2DaiWormholeGateway
          .connect(user1)
          ['initiateWormhole(bytes32,address,uint128,address)'](
            TARGET_DOMAIN_NAME,
            user2.address,
            WORMHOLE_AMOUNT,
            user2.address,
          ),
      ).to.be.revertedWith(errorMessages.bridgeClosed)
    })

    it('reverts when domain is not whitelisted', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      await expect(
        l2DaiWormholeGateway
          .connect(user1)
          ['initiateWormhole(bytes32,address,uint128,address)'](
            INVALID_DOMAIN_NAME,
            user2.address,
            WORMHOLE_AMOUNT,
            user2.address,
          ),
      ).to.be.revertedWith(errorMessages.invalidDomain)
    })
  })

  describe('initiateWormhole(bytes32,bytes32,uint128,bytes32)', () => {
    it('sends xchain message, burns DAI and marks it for future flush', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Dai, l2DaiWormholeGateway, l1DAIWormholeBridgeMock, l2CrossDomainMessengerMock } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      const l2MessengerNonce = await l2CrossDomainMessengerMock.messageNonce()

      const initTx = await l2DaiWormholeGateway
        .connect(user1)
        ['initiateWormhole(bytes32,bytes32,uint128,bytes32)'](
          TARGET_DOMAIN_NAME,
          addressToBytes32(user1.address),
          WORMHOLE_AMOUNT,
          addressToBytes32(user1.address),
        )
      const l2MessengerSendMessageCallData = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      const wormhole = {
        sourceDomain: SOURCE_DOMAIN_NAME,
        targetDomain: TARGET_DOMAIN_NAME,
        receiver: addressToBytes32(user1.address),
        operator: addressToBytes32(user1.address),
        amount: WORMHOLE_AMOUNT,
        nonce: l2MessengerNonce,
        timestamp: (await ethers.provider.getBlock(initTx.blockNumber as any)).timestamp,
      }
      expect(await l2Dai.balanceOf(user1.address)).to.eq(INITIAL_L2_DAI_SUPPLY - WORMHOLE_AMOUNT)
      expect(await l2Dai.totalSupply()).to.equal(INITIAL_L2_DAI_SUPPLY - WORMHOLE_AMOUNT)
      expect(await l2DaiWormholeGateway.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(WORMHOLE_AMOUNT)
      expect(l2MessengerSendMessageCallData._target).to.equal(l1DAIWormholeBridgeMock.address)
      expect(l2MessengerSendMessageCallData._message).to.equal(
        l1DAIWormholeBridgeMock.interface.encodeFunctionData('finalizeRegisterWormhole', [wormhole]),
      )
      await expect(initTx).to.emit(l2DaiWormholeGateway, 'WormholeInitialized').withArgs(Object.values(wormhole))
    })
  })

  describe('initiateWormhole(bytes32,address,uint128)', () => {
    it('sends xchain message, burns DAI and marks it for future flush', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2Dai, l2DaiWormholeGateway, l1DAIWormholeBridgeMock, l2CrossDomainMessengerMock } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      const l2MessengerNonce = await l2CrossDomainMessengerMock.messageNonce()

      const initTx = await l2DaiWormholeGateway
        .connect(user1)
        ['initiateWormhole(bytes32,address,uint128)'](TARGET_DOMAIN_NAME, user1.address, WORMHOLE_AMOUNT)
      const l2MessengerSendMessageCallData = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      const wormhole = {
        sourceDomain: SOURCE_DOMAIN_NAME,
        targetDomain: TARGET_DOMAIN_NAME,
        receiver: addressToBytes32(user1.address),
        operator: addressToBytes32(ethers.constants.AddressZero),
        amount: WORMHOLE_AMOUNT,
        nonce: l2MessengerNonce,
        timestamp: (await ethers.provider.getBlock(initTx.blockNumber as any)).timestamp,
      }
      expect(await l2Dai.balanceOf(user1.address)).to.eq(INITIAL_L2_DAI_SUPPLY - WORMHOLE_AMOUNT)
      expect(await l2Dai.totalSupply()).to.equal(INITIAL_L2_DAI_SUPPLY - WORMHOLE_AMOUNT)
      expect(await l2DaiWormholeGateway.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(WORMHOLE_AMOUNT)
      expect(l2MessengerSendMessageCallData._target).to.equal(l1DAIWormholeBridgeMock.address)
      expect(l2MessengerSendMessageCallData._message).to.equal(
        l1DAIWormholeBridgeMock.interface.encodeFunctionData('finalizeRegisterWormhole', [wormhole]),
      )
      await expect(initTx).to.emit(l2DaiWormholeGateway, 'WormholeInitialized').withArgs(Object.values(wormhole))
    })
  })

  describe('flush()', () => {
    it('flushes batched debt', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DaiWormholeGateway, l2CrossDomainMessengerMock, l1DAIWormholeBridgeMock } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      // init two wormholes
      await l2DaiWormholeGateway
        .connect(user1)
        ['initiateWormhole(bytes32,address,uint128,address)'](
          TARGET_DOMAIN_NAME,
          user1.address,
          WORMHOLE_AMOUNT,
          user1.address,
        )
      await l2DaiWormholeGateway
        .connect(user1)
        ['initiateWormhole(bytes32,address,uint128,address)'](
          TARGET_DOMAIN_NAME,
          user1.address,
          WORMHOLE_AMOUNT,
          user1.address,
        )
      expect(await l2DaiWormholeGateway.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(WORMHOLE_AMOUNT * 2)

      const flushTx = await l2DaiWormholeGateway.flush(TARGET_DOMAIN_NAME)
      const xDomainMessengerCall = l2CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l2DaiWormholeGateway.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(0)
      expect(xDomainMessengerCall._target).to.equal(l1DAIWormholeBridgeMock.address)
      expect(xDomainMessengerCall._message).to.equal(
        l1DAIWormholeBridgeMock.interface.encodeFunctionData('finalizeFlush', [
          TARGET_DOMAIN_NAME,
          WORMHOLE_AMOUNT * 2,
        ]),
      )
      expect(xDomainMessengerCall._gasLimit).to.equal(0)
      await expect(flushTx)
        .to.emit(l2DaiWormholeGateway, 'Flushed')
        .withArgs(TARGET_DOMAIN_NAME, WORMHOLE_AMOUNT * 2)
    })

    it('cannot flush zero debt', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l2DaiWormholeGateway } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })

      expect(await l2DaiWormholeGateway.batchedDaiToFlush(TARGET_DOMAIN_NAME)).to.eq(0)

      await expect(l2DaiWormholeGateway.flush(TARGET_DOMAIN_NAME)).to.be.revertedWith(errorMessages.zeroDaiFlush)
    })
  })
})

async function setupTest(signers: { l2MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const l2CrossDomainMessengerMock = await deployOptimismContractMock(
    'OVM_L2CrossDomainMessenger',
    { address: await signers.l2MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l2Dai = await simpleDeploy<Dai__factory>('Dai', [])
  const l1DAIWormholeBridgeMock = await deployMock('L1DaiWormholeGateway')
  const l2DaiWormholeGateway = await simpleDeploy<L2DaiWormholeGateway__factory>('L2DaiWormholeGateway', [
    l2CrossDomainMessengerMock.address,
    l2Dai.address,
    l1DAIWormholeBridgeMock.address,
    SOURCE_DOMAIN_NAME,
  ])

  await l2Dai.rely(l2DaiWormholeGateway.address)
  await l2Dai.mint(signers.user1.address, INITIAL_L2_DAI_SUPPLY)
  await l2DaiWormholeGateway.file(FILE_VALID_DOMAINS, TARGET_DOMAIN_NAME, 1)

  return { l2Dai, l1DAIWormholeBridgeMock, l2CrossDomainMessengerMock, l2DaiWormholeGateway }
}
