import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1Escrow__factory } from '../../typechain'
import { deploy } from '../helpers'

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
})

async function setupTest() {
  const l1Dai = await deploy<Dai__factory>('Dai', [])
  const l1Escrow = await deploy<L1Escrow__factory>('L1Escrow', [])

  return { l1Dai, l1Escrow }
}
