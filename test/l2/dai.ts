import { expect } from 'chai'
import { ethers, web3 } from 'hardhat'

const { signERC2612Permit } = require('eth-permit')

require('chai').use(require('chai-as-promised')).should()

const MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935'
import { ZERO_ADDRESS } from '../helpers'

describe('Dai', () => {
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

    it('returns the symbol', async () => {
      const name = await dai.symbol()
      name.should.equal('DAI')
    })

    it('returns the decimals', async () => {
      const name = await dai.decimals()
      name.toString().should.equal('18')
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

      it('transfers dai to yourself', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.user1).transfer(signers.user1.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user1.address)
        balanceAfter.toString().should.equal(balanceBefore.toString())
      })

      it('transfers dai using transferFrom', async () => {
        const balanceBefore = await dai.balanceOf(signers.user2.address)
        await dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user2.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user2.address)
        balanceAfter.toString().should.equal(balanceBefore.add(1).toString())
      })

      it('transfers dai to yourself using transferFrom', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user1.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user1.address)
        balanceAfter.toString().should.equal(balanceBefore.toString())
      })

      it('should not transfer beyond balance', async () => {
        await expect(dai.connect(signers.user1).transfer(signers.user2.address, 100)).to.be.revertedWith(
          'Dai/insufficient-balance',
        )
        await expect(
          dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user2.address, 100),
        ).to.be.revertedWith('Dai/insufficient-balance')
      })

      it('should not transfer to zero address', async () => {
        await expect(dai.connect(signers.user1).transfer(ZERO_ADDRESS, 1)).to.be.revertedWith('')
        await expect(
          dai.connect(signers.user1).transferFrom(signers.user1.address, ZERO_ADDRESS, 1),
        ).to.be.revertedWith('')
      })

      it('should not transfer to dai address', async () => {
        await expect(dai.connect(signers.user1).transfer(dai.address, 1)).to.be.revertedWith('')
        await expect(dai.connect(signers.user1).transferFrom(signers.user1.address, dai.address, 1)).to.be.revertedWith(
          '',
        )
      })

      it('should not allow minting to zero address', async () => {
        await expect(dai.mint(ZERO_ADDRESS, 1)).to.be.revertedWith('')
      })

      it('should not allow minting to dai address', async () => {
        await expect(dai.mint(dai.address, 1)).to.be.revertedWith('')
      })

      it('should not allow minting to address beyond MAX', async () => {
        await expect(dai.mint(signers.user1.address, MAX)).to.be.revertedWith('')
      })

      it('burns own dai', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.user1).burn(signers.user1.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user1.address)
        balanceAfter.toString().should.equal(balanceBefore.sub(1).toString())
      })

      it('should not burn beyond balance', async () => {
        await expect(dai.connect(signers.user1).burn(signers.user1.address, 100)).to.be.revertedWith(
          'Dai/insufficient-balance',
        )
      })

      it('should not burn other', async () => {
        await expect(dai.connect(signers.user2).burn(signers.user1.address, 1)).to.be.revertedWith(
          'Dai/insufficient-allowance',
        )
      })

      it('approves to increase allowance', async () => {
        const allowanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
        await dai.connect(signers.user1).approve(signers.user2.address, 1)
        const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
        allowanceAfter.toString().should.equal(allowanceBefore.add(1).toString())
      })

      it('increaseAllowance to increase allowance', async () => {
        const allowanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
        await dai.connect(signers.user1).increaseAllowance(signers.user2.address, 1)
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
          ),
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
          ).to.be.revertedWith('Dai/insufficient-allowance')
        })

        it('burns dai using burn and allowance', async () => {
          const balanceBefore = await dai.balanceOf(signers.user1.address)
          await dai.connect(signers.user2).burn(signers.user1.address, 1)
          const balanceAfter = await dai.balanceOf(signers.user1.address)
          balanceAfter.toString().should.equal(balanceBefore.sub(1).toString())
        })

        it('should not burn beyond allowance', async () => {
          await expect(dai.connect(signers.user2).burn(signers.user1.address, 2)).to.be.revertedWith(
            'Dai/insufficient-allowance',
          )
        })

        it('increaseAllowance should increase allowance', async () => {
          const balanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
          await dai.connect(signers.user1).increaseAllowance(signers.user2.address, 1)
          const balanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
          balanceAfter.toString().should.equal(balanceBefore.add(1).toString())
        })

        it('should not increaseAllowance beyond MAX', async () => {
          await expect(dai.connect(signers.user1).increaseAllowance(signers.user2.address, MAX)).to.be.revertedWith('')
        })

        it('decreaseAllowance should decrease allowance', async () => {
          const balanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
          await dai.connect(signers.user1).decreaseAllowance(signers.user2.address, 1)
          const balanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
          balanceAfter.toString().should.equal(balanceBefore.sub(1).toString())
        })

        it('should not decreaseAllowance beyond allowance', async () => {
          await expect(dai.connect(signers.user1).decreaseAllowance(signers.user2.address, 2)).to.be.revertedWith(
            'Dai/insufficient-allowance',
          )
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

        it('does not decrease allowance using burn', async () => {
          await dai.connect(signers.user2).burn(signers.user1.address, 1)
          const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
          allowanceAfter.toString().should.equal(MAX)
        })
      })

      describe('auth', async () => {
        it('returns deployer wards', async () => {
          const wards = await dai.wards(signers.deployer.address)
          wards.toString().should.equal('1')
        })

        it('shuold not allow rely from non-authed user', async () => {
          await expect(dai.connect(signers.user1).rely(signers.user2.address)).to.be.revertedWith('Dai/not-authorized')
        })

        it('shuold not allow deny from non-authed user', async () => {
          await expect(dai.connect(signers.user1).deny(signers.user2.address)).to.be.revertedWith('Dai/not-authorized')
        })

        it('should not allow minting from non-authed user', async () => {
          await expect(dai.connect(signers.user1).mint(signers.user1.address, 1)).to.be.revertedWith(
            'Dai/not-authorized',
          )
        })
      })

      describe('events', async () => {
        it('emits Rely event on rely', async () => {
          await expect(dai.connect(signers.deployer).rely(signers.user1.address))
            .to.emit(dai, 'Rely')
            .withArgs(signers.user1.address)
        })

        it('emits Deny event on deny', async () => {
          await dai.connect(signers.deployer).rely(signers.user1.address)
          await expect(dai.connect(signers.user1).deny(signers.deployer.address))
            .to.emit(dai, 'Deny')
            .withArgs(signers.deployer.address)
        })

        it('emits Transfer event on mint', async () => {
          await expect(dai.mint(signers.user1.address, 10))
            .to.emit(dai, 'Transfer')
            .withArgs(ZERO_ADDRESS, signers.user1.address, 10)
        })

        it('emits Transfer event on transfer', async () => {
          await expect(dai.connect(signers.user1).transfer(signers.user2.address, 1))
            .to.emit(dai, 'Transfer')
            .withArgs(signers.user1.address, signers.user2.address, 1)
        })

        it('emits Transfer event on transferFrom', async () => {
          await expect(dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user2.address, 1))
            .to.emit(dai, 'Transfer')
            .withArgs(signers.user1.address, signers.user2.address, 1)
        })

        it('emits Transfer event on burn', async () => {
          await expect(dai.connect(signers.user1).burn(signers.user1.address, 1))
            .to.emit(dai, 'Transfer')
            .withArgs(signers.user1.address, ZERO_ADDRESS, 1)
        })

        it('emits Approval event on approve', async () => {
          await expect(dai.connect(signers.user1).approve(signers.user2.address, 1))
            .to.emit(dai, 'Approval')
            .withArgs(signers.user1.address, signers.user2.address, 1)
        })

        it('emits Approval event on increaseAllowance', async () => {
          await expect(dai.connect(signers.user1).increaseAllowance(signers.user2.address, 1))
            .to.emit(dai, 'Approval')
            .withArgs(signers.user1.address, signers.user2.address, 1)
        })

        it('emits Approval event on decreaseAllowance', async () => {
          await dai.connect(signers.user1).approve(signers.user2.address, 1)
          await expect(dai.connect(signers.user1).decreaseAllowance(signers.user2.address, 1))
            .to.emit(dai, 'Approval')
            .withArgs(signers.user1.address, signers.user2.address, 0)
        })

        it('emits Approval event on permit', async () => {
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
              permitResult.deadline,
              permitResult.v,
              permitResult.r,
              permitResult.s,
            ),
          )
            .to.emit(dai, 'Approval')
            .withArgs(signers.user1.address, signers.user2.address, 1)
        })
      })
    })
  })
})
