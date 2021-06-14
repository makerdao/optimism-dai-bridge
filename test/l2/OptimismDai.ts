import { expect } from 'chai'
import { ethers } from 'hardhat'

import { OptimismDai, OptimismDai__factory } from '../../typechain'
import { assertPublicMethods } from '../helpers'

const L1DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'

describe('OptimismDai', () => {
  let dai: OptimismDai

  beforeEach(async () => {
    const [deployer] = await ethers.getSigners()
    const daiFactory = (await ethers.getContractFactory('OptimismDai', deployer)) as OptimismDai__factory
    dai = await daiFactory.deploy(L1DAI_ADDRESS)
  })

  describe('deployment', async () => {
    it('returns the name', async () => {
      expect(await dai.l1Token()).to.be.eq(L1DAI_ADDRESS)
    })
  })

  describe('supportsInterface', async () => {
    it('returns true for IL2StandardTokenLike interface', async () => {
      // ERC165 uses XOR to check for interface compatibility: https://ethereum.stackexchange.com/questions/41933/bitwise-xor-used-as-signature
      const burn = dai.interface.getSighash('burn(address,uint256)')
      const mint = dai.interface.getSighash('mint(address,uint256)')
      const l1Token = dai.interface.getSighash('l1Token()')
      const combinedSelector = [burn, mint, l1Token].map(ethers.BigNumber.from).reduce((a, b) => a.xor(b))

      expect(await dai.supportsInterface(combinedSelector.toHexString())).to.be.eq(true)
    })

    it('returns true for ERC165 interface', async () => {
      // ERC165 uses XOR to check for interface compatibility: https://ethereum.stackexchange.com/questions/41933/bitwise-xor-used-as-signature
      const selector = dai.interface.getSighash('supportsInterface(bytes4)')

      expect(await dai.supportsInterface(selector)).to.be.eq(true)
    })
  })

  it('has correct public interface', async () => {
    await assertPublicMethods('OptimismDai', [
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
})
