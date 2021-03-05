const DAI = artifacts.require('Dai')
const { signERC2612Permit } = require('eth-permit')
const TestTransferReceiver = artifacts.require('TestTransferReceiver')

const { BN, expectRevert } = require('@openzeppelin/test-helpers')
const { web3 } = require('@openzeppelin/test-helpers/src/setup')
require('chai').use(require('chai-as-promised')).should()

const MAX = "115792089237316195423570985008687907853269984665640564039457584007913129639935"

contract('DAI', (accounts) => {
  const [deployer, user1, user2, user3] = accounts
  let dai

  beforeEach(async () => {
    dai = await DAI.new({ from: deployer })
  })

  describe('deployment', async () => {
    it('returns the name', async () => {
      let name = await dai.name()
      name.should.equal('DAI')
    })

    describe('with a positive balance', async () => {
      beforeEach(async () => {
        await dai.mint({ usr: user1, wad: 10 })
      })

      it('returns the dai balance as total supply', async () => {
        const totalSupply = await dai.totalSupply()
        totalSupply.toString().should.equal('10')
      })

      it('transfers dai', async () => {
        const balanceBefore = await dai.balanceOf(user2)
        await dai.transfer(user2, 1, { from: user1 })
        const balanceAfter = await dai.balanceOf(user2)
        balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString())
      })

      it('transfers dai using transferFrom', async () => {
        const balanceBefore = await dai.balanceOf(user2)
        await dai.transferFrom(user1, user2, 1, { from: user1 })
        const balanceAfter = await dai.balanceOf(user2)
        balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString())
      })

      it('should not transfer beyond balance', async () => {
        await expectRevert(dai.transfer(user2, 100, { from: user1 }))
        await expectRevert(dai.transferFrom(user1, user2, 100, { from: user1 }))
      })

      it('approves to increase allowance', async () => {
        const allowanceBefore = await dai.allowance(user1, user2)
        await dai.approve(user2, 1, { from: user1 })
        const allowanceAfter = await dai.allowance(user1, user2)
        allowanceAfter.toString().should.equal(allowanceBefore.add(new BN('1')).toString())
      })

      it('approves to increase allowance with permit', async () => {
        const permitResult = await signERC2612Permit(web3.currentProvider, dai.address, user1, user2, '1')
        await dai.permit(user1, user2, '1', permitResult.deadline, permitResult.v, permitResult.r, permitResult.s)
        const allowanceAfter = await dai.allowance(user1, user2)
        allowanceAfter.toString().should.equal('1')
      })

      it('does not approve with expired permit', async () => {
        const permitResult = await signERC2612Permit(web3.currentProvider, dai.address, user1, user2, '1')
        await expectRevert(dai.permit(
          user1, user2, '1', 0, permitResult.v, permitResult.r, permitResult.s),
          'WETH: Expired permit'
        )
      })

      it('does not approve with invalid permit', async () => {
        const permitResult = await signERC2612Permit(web3.currentProvider, dai.address, user1, user2, '1')
        await expectRevert(
          dai.permit(user1, user2, '2', permitResult.deadline, permitResult.v, permitResult.r, permitResult.s),
          'WETH: invalid permit'
        )
      })

      describe('with a positive allowance', async () => {
        beforeEach(async () => {
          await dai.approve(user2, 1, { from: user1 })
        })

        it('transfers dai using transferFrom and allowance', async () => {
          const balanceBefore = await dai.balanceOf(user2)
          await dai.transferFrom(user1, user2, 1, { from: user2 })
          const balanceAfter = await dai.balanceOf(user2)
          balanceAfter.toString().should.equal(balanceBefore.add(new BN('1')).toString())
        })

        it('should not transfer beyond allowance', async () => {
          await expectRevert(dai.transferFrom(user1, user2, 2, { from: user2 }))
        })
      })

      describe('with a maximum allowance', async () => {
        beforeEach(async () => {
          await dai.approve(user2, MAX, { from: user1 })
        })

        it('does not decrease allowance using transferFrom', async () => {
          await dai.transferFrom(user1, user2, 1, { from: user2 })
          const allowanceAfter = await dai.allowance(user1, user2)
          allowanceAfter.toString().should.equal(MAX)
        })

        it('does not decrease allowance using withdrawFrom', async () => {
          await dai.withdrawFrom(user1, user2, 1, { from: user2 })
          const allowanceAfter = await dai.allowance(user1, user2)
          allowanceAfter.toString().should.equal(MAX)
        })
      })
    })
  })
})