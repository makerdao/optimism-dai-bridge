import { expect } from 'chai'
import { ethers } from 'hardhat'

import { getActiveWards } from '../test-e2e/helpers/auth'
import { AuthableContract } from '../test-e2e/helpers/AuthableContract'
import { getRandomAddress } from './helpers'

export function testAuth(
  name: string,
  getDeployArgs: () => Promise<any[]>,
  authedMethods: Array<(contract: any) => Promise<any>>,
) {
  describe('auth', () => {
    async function deploy() {
      const [deployer] = await ethers.getSigners()

      const contractFactory = await ethers.getContractFactory(name)
      const deployTxReq = contractFactory.getDeployTransaction(...(await getDeployArgs()))
      const deployTx = await deployer.sendTransaction(deployTxReq)
      const deployReceipt = await deployTx.wait()
      const contract = (await ethers.getContractAt(name, deployReceipt.contractAddress)) as AuthableContract

      return { deployer, contract, deployTx }
    }

    it('makes initially the deployer the only ward', async () => {
      const { deployer, contract, deployTx } = await deploy()

      expect(await getActiveWards(contract)).to.be.deep.eq([deployer.address])
      await expect(deployTx).to.emit(contract, 'Rely').withArgs(deployer.address)
    })

    it('relies on new addresses', async () => {
      const { deployer, contract } = await deploy()
      const randomAddress = await getRandomAddress()

      const relyTx = await contract.rely(randomAddress)

      expect((await getActiveWards(contract)).sort()).to.be.deep.eq([deployer.address, randomAddress].sort())
      await expect(relyTx).to.emit(contract, 'Rely').withArgs(randomAddress)
    })

    it('denies old addresses', async () => {
      const { deployer, contract } = await deploy()
      const randomAddress = await getRandomAddress()

      await contract.rely(randomAddress)
      const denyTx = await contract.deny(deployer.address)

      expect((await getActiveWards(contract)).sort()).to.be.deep.eq([randomAddress].sort())
      await expect(denyTx).to.emit(contract, 'Deny').withArgs(deployer.address)
    })

    it('only a ward can change permissions', async () => {
      const { contract } = await deploy()
      const [_, unauthorized] = await ethers.getSigners()
      const randomAddress = await getRandomAddress()

      await expect(contract.connect(unauthorized).rely(randomAddress)).to.be.revertedWith(`${name}/not-authorized`)
      await expect(contract.connect(unauthorized).deny(randomAddress)).to.be.revertedWith(`${name}/not-authorized`)
    })

    it('only a ward can run authed methods', async () => {
      const { contract } = await deploy()
      const [_, unauthorized] = await ethers.getSigners()

      const contractWithUnauthorizedSigner = contract.connect(unauthorized)

      for (const authedMethod of authedMethods) {
        await expect(authedMethod(contractWithUnauthorizedSigner)).to.be.revertedWith(`${name}/not-authorized`)
      }
    })
  })
}
