import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { L1GovernanceRelay__factory } from '../../typechain'
import { testAuth } from '../auth'
import { assertPublicMethods, deploy, deployMock, deployOptimismContractMock, getRandomAddresses } from '../helpers'

const errorMessages = {
  invalidMessenger: 'OVM_XCHAIN: messenger contract unauthenticated',
  invalidXDomainMessageOriginator: 'OVM_XCHAIN: wrong sender of cross-domain message',
  notAuthed: 'L1GovernanceRelay/not-authorized',
}

const SPELL_GAS = 5000000

describe('L1GovernanceRelay', () => {
  describe('relay()', () => {
    it('sends xchain message on relay', async () => {
      const [deployer, l1MessengerImpersonator, l2spell] = await ethers.getSigners()
      const { l1GovernanceRelay, l1CrossDomainMessengerMock, l2GovernanceRelay } = await setupTest({
        l1MessengerImpersonator,
      })

      await l1GovernanceRelay.connect(deployer).relay(l2spell.address, [], SPELL_GAS)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(depositCallToMessengerCall._target).to.equal(l2GovernanceRelay.address)
      expect(depositCallToMessengerCall._message).to.equal(
        l2GovernanceRelay.interface.encodeFunctionData('relay', [l2spell.address, []]),
      )
    })

    it('reverts when not authed', async () => {
      const [_deployer, l1MessengerImpersonator, user1, l2spell] = await ethers.getSigners()
      const { l1GovernanceRelay } = await setupTest({
        l1MessengerImpersonator,
      })

      await expect(l1GovernanceRelay.connect(user1).relay(l2spell.address, [], SPELL_GAS)).to.be.revertedWith(
        errorMessages.notAuthed,
      )
    })
  })

  describe('constructor', () => {
    it('assigns all variables properly', async () => {
      const [l2GovernanceRelay, l1CrossDomainMessenger] = await ethers.getSigners()

      const l1GovRelay = await deploy<L1GovernanceRelay__factory>('L1GovernanceRelay', [
        l2GovernanceRelay.address,
        l1CrossDomainMessenger.address,
      ])

      expect(await l1GovRelay.l2GovernanceRelay()).to.eq(l2GovernanceRelay.address)
      expect(await l1GovRelay.messenger()).to.eq(l1CrossDomainMessenger.address)
    })
  })

  it('has correct public interface', async () => {
    await assertPublicMethods('L1GovernanceRelay', ['rely(address)', 'deny(address)', 'relay(address,bytes,uint32)'])
  })

  testAuth(
    'L1GovernanceRelay',
    async () => {
      const [l2GovernanceRelay, l1CrossDomainMessengerMock] = await getRandomAddresses()

      return [l2GovernanceRelay, l1CrossDomainMessengerMock]
    },
    [
      async (c) => {
        const [a] = await getRandomAddresses()
        return c.relay(a, '0x', 0)
      },
    ],
  )
})

async function setupTest(signers: { l1MessengerImpersonator: SignerWithAddress }) {
  const l2GovernanceRelay = await deployMock('L2GovernanceRelay')
  const l1CrossDomainMessengerMock = await deployOptimismContractMock(
    'OVM_L1CrossDomainMessenger',
    { address: await signers.l1MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
  )
  const l1GovernanceRelay = await deploy<L1GovernanceRelay__factory>('L1GovernanceRelay', [
    l2GovernanceRelay.address,
    l1CrossDomainMessengerMock.address,
  ])

  return { l1GovernanceRelay, l1CrossDomainMessengerMock, l2GovernanceRelay }
}
