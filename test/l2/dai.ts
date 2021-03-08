import { ethers } from 'hardhat'

const { signERC2612Permit } = require('eth-permit')

const { BN, expectRevert } = require('@openzeppelin/test-helpers')
const { web3 } = require('@openzeppelin/test-helpers/src/setup')
require('chai').use(require('chai-as-promised')).should()

const MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

describe('Counter', () => {
  let signers: any
  let dai: any

  beforeEach(async () => {
    const [deployer, user1, user2, user3] = await ethers.getSigners()
    signers = { deployer, user1, user2, user3 }
    const daiFactory = await ethers.getContractFactory('Dai', signers[0])
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
        await dai.transferFrom(signers.user1, signers.user2, 1, { from: signers.user1 })
        const balanceAfter = await dai.balanceOf(signers.user2)
        balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString())
      })

      it('should not transfer beyond balance', async () => {
        await expectRevert(dai.transfer(signers.user2, 100, { from: signers.user1 }))
        await expectRevert(dai.transferFrom(signers.user1, signers.user2, 100, { from: signers.user1 }))
      })

      it('approves to increase allowance', async () => {
        const allowanceBefore = await dai.allowance(signers.user1, signers.user2)
        await dai.approve(signers.user2, 1, { from: signers.user1 })
        const allowanceAfter = await dai.allowance(signers.user1, signers.user2)
        allowanceAfter.toString().should.equal(allowanceBefore.add(new BN('1')).toString())
      })

      it('approves to increase allowance with permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1,
          signers.user2,
          '1',
        )
        await dai.permit(
          signers.user1,
          signers.user2,
          '1',
          permitResult.deadline,
          permitResult.v,
          permitResult.r,
          permitResult.s,
        )
        const allowanceAfter = await dai.allowance(signers.user1, signers.user2)
        allowanceAfter.toString().should.equal('1')
      })

      it('does not approve with expired permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1,
          signers.user2,
          '1',
        )
        await expectRevert(
          dai.permit(signers.user1, signers.user2, '1', 0, permitResult.v, permitResult.r, permitResult.s),
          'WETH: Expired permit',
        )
      })

      it('does not approve with invalid permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1,
          signers.user2,
          '1',
        )
        await expectRevert(
          dai.permit(
            signers.user1,
            signers.user2,
            '2',
            permitResult.deadline,
            permitResult.v,
            permitResult.r,
            permitResult.s,
          ),
          'WETH: invalid permit',
        )
      })

      describe('with a positive allowance', async () => {
        beforeEach(async () => {
          await dai.approve(signers.user2, 1, { from: signers.user1 })
        })

        it('transfers dai using transferFrom and allowance', async () => {
          const balanceBefore = await dai.balanceOf(signers.user2)
          await dai.transferFrom(signers.user1, signers.user2, 1, { from: signers.user2 })
          const balanceAfter = await dai.balanceOf(signers.user2)
          balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString())
        })

        it('should not transfer beyond allowance', async () => {
          await expectRevert(dai.transferFrom(signers.user1, signers.user2, 2, { from: signers.user2 }))
        })
      })

      describe('with a maximum allowance', async () => {
        beforeEach(async () => {
          await dai.approve(signers.user2, MAX, { from: signers.user1 })
        })

        it('does not decrease allowance using transferFrom', async () => {
          await dai.transferFrom(signers.user1, signers.user2, 1, { from: signers.user2 })
          const allowanceAfter = await dai.allowance(signers.user1, signers.user2)
          allowanceAfter.toString().should.equal(MAX)
        })

        it('does not decrease allowance using withdrawFrom', async () => {
          await dai.withdrawFrom(signers.user1, signers.user2, 1, { from: signers.user2 })
          const allowanceAfter = await dai.allowance(signers.user1, signers.user2)
          allowanceAfter.toString().should.equal(MAX)
        })
      })
    })
  })
})
