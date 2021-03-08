import { ethers, web3 } from 'hardhat'
import { expect } from 'chai';

const { signERC2612Permit } = require('eth-permit')

require('chai').use(require('chai-as-promised')).should()

const MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

describe('Counter', () => {
  let signers: any
  let dai: any

  beforeEach(async () => {
    const [deployer, user1, user2, user3] = await ethers.getSigners()
    signers = { deployer, user1, user2, user3 }
    const daiFactory = await ethers.getContractFactory('Dai', deployer)
    dai = await daiFactory.deploy()
  })

  describe('deployment', async () => {
    it('returns the name', async () => {
      const name = await dai.name()
      name.should.equal('Dai Stablecoin')
    })

    describe('with a positive balance', async () => {
      beforeEach(async () => {
        await dai.mint(signers.user1.address, 10)
      })

      it('returns the dai balance as total supply', async () => {
        const totalSupply = await dai.totalSupply()
        totalSupply.toString().should.equal('10')
      })

      it('transfers dai', async () => {
        const balanceBefore = await dai.balanceOf(signers.user2.address)
        await dai.connect(signers.user1).transfer(signers.user2.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user2.address)
        balanceAfter.toString().should.equal(balanceBefore.add(1).toString())
      })

      it('transfers dai using transferFrom', async () => {
        const balanceBefore = await dai.balanceOf(signers.user2.address)
        await dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user2.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user2.address)
        balanceAfter.toString().should.equal(balanceBefore.add(1).toString())
      })

      it('should not transfer beyond balance', async () => {
        await expect(dai.connect(signers.user1).transfer(signers.user2.address, 100)).to.be.reverted
        await expect(dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user2.address, 100)).to.be.reverted
      })

      it('approves to increase allowance', async () => {
        const allowanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
        await dai.connect(signers.user1).approve(signers.user2.address, 1)
        const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
        allowanceAfter.toString().should.equal(allowanceBefore.add(1).toString())
      })

      it('approves to increase allowance with permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1.address,
          signers.user2.address,
          '1',
        )
        await dai.permit(
          signers.user1.address,
          signers.user2.address,
          '1',
          permitResult.deadline,
          permitResult.v,
          permitResult.r,
          permitResult.s,
        )
        const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
        allowanceAfter.toString().should.equal('1')
      })

      it('does not approve with expired permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1.address,
          signers.user2.address,
          '1',
        )
        await expect(
          dai.permit(
            signers.user1.address,
            signers.user2.address,
            '1',
            0,
            permitResult.v,
            permitResult.r,
            permitResult.s,
          )
        ).to.be.revertedWith('Dai/permit-expired')
      })

      it('does not approve with invalid permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1.address,
          signers.user2.address,
          '1',
        )
        await expect(
          dai.permit(
            signers.user1.address,
            signers.user2.address,
            '2',
            permitResult.deadline,
            permitResult.v,
            permitResult.r,
            permitResult.s,
          ),
          'Dai/invalid-permit',
        ).to.be.revertedWith('Dai/invalid-permit')
      })

      describe('with a positive allowance', async () => {
        beforeEach(async () => {
          await dai.connect(signers.user1).approve(signers.user2.address, 1)
        })

        it('transfers dai using transferFrom and allowance', async () => {
          const balanceBefore = await dai.balanceOf(signers.user2.address)
          await dai.connect(signers.user2).transferFrom(signers.user1.address, signers.user2.address, 1)
          const balanceAfter = await dai.balanceOf(signers.user2.address)
          balanceAfter.toString().should.equal(balanceBefore.add(1).toString())
        })

        it('should not transfer beyond allowance', async () => {
          await expect(
            dai.connect(signers.user2).transferFrom(signers.user1.address, signers.user2.address, 2),
          ).to.be.reverted
        })
      })

      describe('with a maximum allowance', async () => {
        beforeEach(async () => {
          await dai.connect(signers.user1).approve(signers.user2.address, MAX)
        })

        it('does not decrease allowance using transferFrom', async () => {
          await dai.connect(signers.user2).transferFrom(signers.user1.address, signers.user2.address, 1)
          const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
          allowanceAfter.toString().should.equal(MAX)
        })
      })
    })
  })
})
