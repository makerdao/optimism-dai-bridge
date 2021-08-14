import { assertPublicMutableMethods, getRandomAddresses, simpleDeploy, testAuth } from '@makerdao/hardhat-utils'
import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1Escrow__factory } from '../../typechain'

const allowanceLimit = 100

const errorMessages = {
  notAuthed: 'L1Escrow/not-authorized',
}

describe('L1Escrow', () => {
  describe('approve()', () => {
    it('sets approval on erc20 tokens', async () => {
      const [_deployer, spender] = await ethers.getSigners()
      const { l1Dai, l1Escrow } = await setupTest()

      expect(await l1Dai.allowance(l1Escrow.address, spender.address)).to.be.eq(0)

      await l1Escrow.approve(l1Dai.address, spender.address, allowanceLimit)

      expect(await l1Dai.allowance(l1Escrow.address, spender.address)).to.be.eq(allowanceLimit)
    })

    it('emits Approval event', async () => {
      const [_deployer, spender] = await ethers.getSigners()
      const { l1Dai, l1Escrow } = await setupTest()

      await expect(l1Escrow.approve(l1Dai.address, spender.address, allowanceLimit))
        .to.emit(l1Escrow, 'Approve')
        .withArgs(l1Dai.address, spender.address, allowanceLimit)
    })

    it('reverts when called by unauthed user', async () => {
      const [_deployer, spender, notDeployer] = await ethers.getSigners()
      const { l1Dai, l1Escrow } = await setupTest()

      await expect(
        l1Escrow.connect(notDeployer).approve(l1Dai.address, spender.address, allowanceLimit),
      ).to.be.revertedWith(errorMessages.notAuthed)
    })
  })

  it('has correct public interface', async () => {
    await assertPublicMutableMethods('L1Escrow', ['rely(address)', 'deny(address)', 'approve(address,address,uint256)'])
  })

  testAuth({
    name: 'L1Escrow',
    getDeployArgs: async () => [],
    authedMethods: [
      async (c) => {
        const [a, b] = await getRandomAddresses()
        return c.approve(a, b, 1)
      },
    ],
  })
})

async function setupTest() {
  const l1Dai = await simpleDeploy<Dai__factory>('Dai', [])
  const l1Escrow = await simpleDeploy<L1Escrow__factory>('L1Escrow', [])

  return { l1Dai, l1Escrow }
}
