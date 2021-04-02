import { expect } from 'chai'
import { ethers } from 'hardhat'

import { Dai__factory, L1Escrow__factory } from '../../typechain'
import { deploy } from '../helpers'

const allowanceLimit = 100

const errorMessages = {
  notOwner: 'Ownable: caller is not the owner',
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

    it('reverts when called not by an owner', async () => {
      const [_deployer, spender, notDeployer] = await ethers.getSigners()
      const { l1Dai, l1Escrow } = await setupTest()

      await expect(
        l1Escrow.connect(notDeployer).approve(l1Dai.address, spender.address, allowanceLimit),
      ).to.be.rejectedWith(errorMessages.notOwner)
    })
  })
})

async function setupTest() {
  const l1Dai = await deploy<Dai__factory>('Dai', [])
  const l1Escrow = await deploy<L1Escrow__factory>('L1Escrow', [])

  return { l1Dai, l1Escrow }
}
