import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L2GovernanceRelay__factory, TestDaiMintSpell__factory } from '../../typechain'
import { BadSpell__factory } from '../../typechain/factories/BadSpell__factory'
import { assertPublicMethods, deploy, deployMock, deployOptimismContractMock } from '../helpers'

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageOriginator: 'OVM_XCHAIN: wrong sender of cross-domain message',
  delegatecallError: 'L2GovernanceRelay/delegatecall-error',
  illegalStorageChange: 'L2GovernanceRelay/illegal-storage-change',
}

describe('OVM_L2GovernanceRelay', () => {
  describe('relay', () => {
    const depositAmount = 100

    it('mints new tokens', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const {
        l1GovernanceRelay,
        l2GovernanceRelay,
        l2CrossDomainMessengerMock,
        l2Dai,
        l2daiMintSpell,
      } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GovernanceRelay.address)

      await l2GovernanceRelay
        .connect(l2MessengerImpersonator)
        .relay(
          l2daiMintSpell.address,
          l2daiMintSpell.interface.encodeFunctionData('mintDai', [l2Dai.address, user1.address, depositAmount]),
        )

      expect(await l2Dai.balanceOf(user1.address)).to.be.eq(depositAmount)
      expect(await l2Dai.totalSupply()).to.be.eq(depositAmount)
    })

    it('reverts when called not by XDomainMessenger', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l1GovernanceRelay, l2CrossDomainMessengerMock, l2GovernanceRelay } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GovernanceRelay.address)

      await expect(l2GovernanceRelay.connect(user2).relay(user1.address, [])).to.be.revertedWith(
        errorMessages.invalidMessenger,
      )
    })

    it('reverts when called by XDomainMessenger but not relying message from l1GovernanceRelay', async () => {
      const [_, l2MessengerImpersonator, user1, user2] = await ethers.getSigners()
      const { l2CrossDomainMessengerMock, l2GovernanceRelay } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => user2.address)

      await expect(l2GovernanceRelay.connect(l2MessengerImpersonator).relay(user1.address, [])).to.be.revertedWith(
        errorMessages.invalidXDomainMessageOriginator,
      )
    })

    it('reverts when spell tries to modify storage', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1GovernanceRelay, l2GovernanceRelay, l2CrossDomainMessengerMock } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      const badSpell = await deploy<BadSpell__factory>('BadSpell')
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GovernanceRelay.address)

      await expect(
        l2GovernanceRelay
          .connect(l2MessengerImpersonator)
          .relay(badSpell.address, badSpell.interface.encodeFunctionData('modifyStorage')),
      ).to.be.revertedWith(errorMessages.illegalStorageChange)
    })

    it('reverts when spell reverts', async () => {
      const [_, l2MessengerImpersonator, user1] = await ethers.getSigners()
      const { l1GovernanceRelay, l2GovernanceRelay, l2CrossDomainMessengerMock } = await setupTest({
        l2MessengerImpersonator,
        user1,
      })
      const badSpell = await deploy<BadSpell__factory>('BadSpell')
      l2CrossDomainMessengerMock.smocked.xDomainMessageSender.will.return.with(() => l1GovernanceRelay.address)

      await expect(
        l2GovernanceRelay
          .connect(l2MessengerImpersonator)
          .relay(badSpell.address, badSpell.interface.encodeFunctionData('abort')),
      ).to.be.revertedWith(errorMessages.delegatecallError)
    })
  })

  describe('constructor', () => {
    it('assigns all variables properly', async () => {
      const [l2Messenger, l1GovRelay] = await ethers.getSigners()

      const l2GovRelay = await deploy<L2GovernanceRelay__factory>('L2GovernanceRelay', [
        l2Messenger.address,
        l1GovRelay.address,
      ])

      expect(await l2GovRelay.messenger()).to.eq(l2Messenger.address)
      expect(await l2GovRelay.l1GovernanceRelay()).to.eq(l1GovRelay.address)
    })
  })

  it('has correct public interface', async () => {
    await assertPublicMethods('L2GovernanceRelay', ['relay(address,bytes)'])
  })
})

async function setupTest(signers: { l2MessengerImpersonator: SignerWithAddress; user1: SignerWithAddress }) {
  const l2CrossDomainMessengerMock = await deployOptimismContractMock(
    'OVM_L2CrossDomainMessenger',
    { address: await signers.l2MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l2Dai = await deploy<Dai__factory>('Dai', [])

  const l1GovernanceRelay = await deployMock('L1GovernanceRelay')
  const l2GovernanceRelay = await deploy<L2GovernanceRelay__factory>('L2GovernanceRelay', [
    l2CrossDomainMessengerMock.address,
    l1GovernanceRelay.address,
  ])
  await l2Dai.rely(l2GovernanceRelay.address)

  const l2daiMintSpell = await deploy<TestDaiMintSpell__factory>('TestDaiMintSpell', [])

  return { l2Dai, l1GovernanceRelay, l2CrossDomainMessengerMock, l2GovernanceRelay, l2daiMintSpell }
}
