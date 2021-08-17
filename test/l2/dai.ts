import { assertPublicMutableMethods, getRandomAddresses, testAuth } from '@makerdao/hardhat-utils'
import { expect } from 'chai'
import { ethers, web3 } from 'hardhat'

import { Dai, Dai__factory } from '../../typechain'

const { signERC2612Permit } = require('./eth-permit/eth-permit')

describe('Dai', () => {
  let signers: any
  let dai: Dai

  beforeEach(async () => {
    const [deployer, user1, user2, user3] = await ethers.getSigners()
    signers = { deployer, user1, user2, user3 }
    const daiFactory = (await ethers.getContractFactory('Dai', deployer)) as Dai__factory
    dai = await daiFactory.deploy()
  })

  describe('deployment', async () => {
    it('returns the name', async () => {
      expect(await dai.name()).to.be.eq('Dai Stablecoin')
    })

    it('returns the symbol', async () => {
      expect(await dai.symbol()).to.be.eq('DAI')
    })

    it('returns the decimals', async () => {
      expect(await dai.decimals()).to.be.eq(18)
    })

    describe('with a positive balance', async () => {
      beforeEach(async () => {
        await dai.mint(signers.user1.address, 10)
      })

      it('returns the dai balance as total supply', async () => {
        expect(await dai.totalSupply()).to.be.eq('10')
      })

      it('transfers dai', async () => {
        const balanceBefore = await dai.balanceOf(signers.user2.address)
        await dai.connect(signers.user1).transfer(signers.user2.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user2.address)
        expect(balanceAfter).to.be.eq(balanceBefore.add(1))
      })

      it('transfers dai to yourself', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.user1).transfer(signers.user1.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user1.address)
        expect(balanceAfter).to.be.eq(balanceBefore)
      })

      it('transfers dai using transferFrom', async () => {
        const balanceBefore = await dai.balanceOf(signers.user2.address)
        await dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user2.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user2.address)
        expect(balanceAfter).to.be.eq(balanceBefore.add(1))
      })

      it('transfers dai to yourself using transferFrom', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.user1).transferFrom(signers.user1.address, signers.user1.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user1.address)
        expect(balanceAfter).to.be.eq(balanceBefore)
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
        await expect(dai.connect(signers.user1).transfer(ethers.constants.AddressZero, 1)).to.be.revertedWith(
          'Dai/invalid-address',
        )
        await expect(
          dai.connect(signers.user1).transferFrom(signers.user1.address, ethers.constants.AddressZero, 1),
        ).to.be.revertedWith('Dai/invalid-address')
      })

      it('should not transfer to dai address', async () => {
        await expect(dai.connect(signers.user1).transfer(dai.address, 1)).to.be.revertedWith('Dai/invalid-address')
        await expect(dai.connect(signers.user1).transferFrom(signers.user1.address, dai.address, 1)).to.be.revertedWith(
          'Dai/invalid-address',
        )
      })

      it('should not allow minting to zero address', async () => {
        await expect(dai.mint(ethers.constants.AddressZero, 1)).to.be.revertedWith('Dai/invalid-address')
      })

      it('should not allow minting to dai address', async () => {
        await expect(dai.mint(dai.address, 1)).to.be.revertedWith('Dai/invalid-address')
      })

      it('should not allow minting to address beyond MAX', async () => {
        await expect(dai.mint(signers.user1.address, ethers.constants.MaxUint256)).to.be.reverted
      })

      it('burns own dai', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.user1).burn(signers.user1.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user1.address)
        expect(balanceAfter).to.be.eq(balanceBefore.sub(1))
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

      it('deployer can burn other', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.deployer).burn(signers.user1.address, 1)
        const balanceAfter = await dai.balanceOf(signers.user1.address)
        expect(balanceAfter).to.be.eq(balanceBefore.sub(1))
      })

      it('can burn other if approved', async () => {
        const balanceBefore = await dai.balanceOf(signers.user1.address)
        await dai.connect(signers.user1).approve(signers.user2.address, 1)

        await dai.connect(signers.user2).burn(signers.user1.address, 1)

        const balanceAfter = await dai.balanceOf(signers.user1.address)
        expect(balanceAfter).to.be.eq(balanceBefore.sub(1))
      })

      it('approves to increase allowance', async () => {
        const allowanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
        await dai.connect(signers.user1).approve(signers.user2.address, 1)
        const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
        expect(allowanceAfter).to.be.eq(allowanceBefore.add(1))
      })

      it('increaseAllowance to increase allowance', async () => {
        const allowanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
        await dai.connect(signers.user1).increaseAllowance(signers.user2.address, 1)
        const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
        expect(allowanceAfter).to.be.eq(allowanceBefore.add(1))
      })

      it('approves to increase allowance with permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1.address,
          signers.user2.address,
          '1',
          null,
          null,
          '2',
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
        expect(allowanceAfter).to.be.eq('1')
      })

      it('does not approve with expired permit', async () => {
        const permitResult = await signERC2612Permit(
          web3.currentProvider,
          dai.address,
          signers.user1.address,
          signers.user2.address,
          '1',
          null,
          null,
          '2',
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
          null,
          null,
          '2',
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
          expect(balanceAfter).to.be.eq(balanceBefore.add(1))
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
          expect(balanceAfter).to.be.eq(balanceBefore.sub(1))
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
          expect(balanceAfter).to.be.eq(balanceBefore.add(1))
        })

        it('should not increaseAllowance beyond MAX', async () => {
          await expect(dai.connect(signers.user1).increaseAllowance(signers.user2.address, ethers.constants.MaxUint256))
            .to.be.reverted
        })

        it('decreaseAllowance should decrease allowance', async () => {
          const balanceBefore = await dai.allowance(signers.user1.address, signers.user2.address)
          await dai.connect(signers.user1).decreaseAllowance(signers.user2.address, 1)
          const balanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
          expect(balanceAfter).to.be.eq(balanceBefore.sub(1))
        })

        it('should not decreaseAllowance beyond allowance', async () => {
          await expect(dai.connect(signers.user1).decreaseAllowance(signers.user2.address, 2)).to.be.revertedWith(
            'Dai/insufficient-allowance',
          )
        })
      })

      describe('with a maximum allowance', async () => {
        beforeEach(async () => {
          await dai.connect(signers.user1).approve(signers.user2.address, ethers.constants.MaxUint256)
        })

        it('does not decrease allowance using transferFrom', async () => {
          await dai.connect(signers.user2).transferFrom(signers.user1.address, signers.user2.address, 1)
          const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
          expect(allowanceAfter).to.be.eq(ethers.constants.MaxUint256)
        })

        it('does not decrease allowance using burn', async () => {
          await dai.connect(signers.user2).burn(signers.user1.address, 1)
          const allowanceAfter = await dai.allowance(signers.user1.address, signers.user2.address)
          expect(allowanceAfter).to.be.eq(ethers.constants.MaxUint256)
        })
      })

      describe('events', async () => {
        it('emits Transfer event on mint', async () => {
          await expect(dai.mint(signers.user1.address, 10))
            .to.emit(dai, 'Transfer')
            .withArgs(ethers.constants.AddressZero, signers.user1.address, 10)
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
            .withArgs(signers.user1.address, ethers.constants.AddressZero, 1)
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
            null,
            null,
            '2',
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

  it('has correct public interface', async () => {
    await assertPublicMutableMethods('Dai', [
      'rely(address)',
      'deny(address)',
      'approve(address,uint256)',
      'burn(address,uint256)',
      'decreaseAllowance(address,uint256)',
      'increaseAllowance(address,uint256)',
      'mint(address,uint256)',
      'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)',
      'transfer(address,uint256)',
      'transferFrom(address,address,uint256)',
    ])
  })

  testAuth({
    name: 'Dai',
    getDeployArgs: async () => [],
    authedMethods: [
      async (c) => {
        const [to] = await getRandomAddresses()
        return c.mint(to, 1)
      },
    ],
  })
})
