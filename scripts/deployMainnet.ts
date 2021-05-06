/**
 * Full mainnet deploy including any permissions that need to be set.
 */
import hre from 'hardhat'
import { AuthLike, Dai, L1ERC20Gateway, L1Escrow, L1GovernanceRelay } from '../typechain'
import { deployContract, MAX_UINT256 } from '../test-e2e/helpers/utils'

const L1_PAUSE_PROXY_ADDRESS = '0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB'
const L1_ESM_ADDRESS = '0x29CfBd381043D00a98fD9904a431015Fef07af2f'
const L1_DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const deployerAddress = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
const ZERO_ADDRESS = deployerAddress

async function main() {
  const { ethers: l1 } = hre
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [deployerAddress],
  })
  const deployer = hre.ethers.provider.getSigner(deployerAddress)

  // Bridge deploy
  const l1Escrow = await deployContract<L1Escrow>(deployer, await l1.getContractFactory('L1Escrow'), [])
  // TODO deploy L2 dai
  // TODO deploy L2 gateway
  const l1Gateway = await deployContract<L1ERC20Gateway>(deployer, await l1.getContractFactory('L1ERC20Gateway'), [
    L1_DAI_ADDRESS,
    ZERO_ADDRESS,
    ZERO_ADDRESS,
    l1Escrow.address,
  ])
  // TODO init L2 gateway

  // Governance deploy
  // TODO deploy L2 governance relay
  const l1GovernanceRelay = await deployContract<L1GovernanceRelay>(
    deployer,
    await l1.getContractFactory('L1GovernanceRelay'),
    [ZERO_ADDRESS, ZERO_ADDRESS],
  )
  // // TODO init L2 governance relay
  // // Permissions
  await l1Escrow.connect(deployer).approve(L1_DAI_ADDRESS, L1_PAUSE_PROXY_ADDRESS, MAX_UINT256)
  await l1Escrow.connect(deployer).approve(L1_DAI_ADDRESS, L1_ESM_ADDRESS, MAX_UINT256)
  await l1Escrow.connect(deployer).approve(L1_DAI_ADDRESS, deployer._address, 0)
  // // TODO l2dai rely() L2 gateway
  // // TODO l2dai rely() L2 governance relay
  // // TODO l2dai deny() deployer
  // // TODO gateway transferOwnership() to governance relay
  await l1GovernanceRelay.rely(L1_PAUSE_PROXY_ADDRESS)
  await l1GovernanceRelay.rely(L1_ESM_ADDRESS)
  await l1GovernanceRelay.deny(deployer._address)
}

main()
  .then(() => console.log('DONE'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
