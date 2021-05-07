/**
 * Full mainnet deploy including any permissions that need to be set.
 * Uses forked mainnat as L1, and kovan optimism rollup as L2.
 * In such setup xchain messages doesn't work.
 */
import hre from 'hardhat'
import {
  AuthLike,
  Dai,
  L1ERC20Gateway,
  L1Escrow,
  L1GovernanceRelay,
  L2DepositedToken,
  L2GovernanceRelay,
} from '../typechain'
import { ZERO_GAS_OPTS, deployContract, getL2Factory, MAX_UINT256 } from '../test-e2e/helpers/utils'
import { JsonRpcProvider } from '@ethersproject/providers'

const L1_PAUSE_PROXY_ADDRESS = '0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB'
const L1_ESM_ADDRESS = '0x29CfBd381043D00a98fD9904a431015Fef07af2f'
const L1_DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const L1_DEPLOYER_ADDRESS = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
const L2_DEPLOYER_PRIV_KEY = '6ea93392eb84fad521111def2e8fbd9c45c2b085907797e1a60a210d5bf7089d'
const L2_RPC_URL = 'https://kovan.optimism.io/'
const L2_XDOMAIN_MESSENGER = '0x4200000000000000000000000000000000000007'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function main() {
  const { ethers: l1 } = hre
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [L1_DEPLOYER_ADDRESS],
  })
  const deployer = hre.ethers.provider.getSigner(L1_DEPLOYER_ADDRESS)

  const l2Provider = new JsonRpcProvider(L2_RPC_URL)
  const l2Deployer = new hre.ethers.Wallet(L2_DEPLOYER_PRIV_KEY, l2Provider)

  // Bridge deploy
  const l1Escrow = await deployContract<L1Escrow>(deployer, await l1.getContractFactory('L1Escrow'), [])
  console.log('L1Escrow: ', l1Escrow.address)
  const l2Dai = await deployContract<Dai>(l2Deployer, await getL2Factory('Dai'), [])
  console.log('L2 DAI: ', l2Dai.address)
  const l2Gateway = await deployContract<L2DepositedToken>(l2Deployer, await getL2Factory('L2DepositedToken'), [
    L2_XDOMAIN_MESSENGER,
    l2Dai.address,
  ])
  console.log('L2 Gateway: ', l2Gateway.address)
  const l1Gateway = await deployContract<L1ERC20Gateway>(deployer, await l1.getContractFactory('L1ERC20Gateway'), [
    L1_DAI_ADDRESS,
    l2Gateway.address,
    ZERO_ADDRESS,
    l1Escrow.address,
  ])
  console.log('L1 Gateway: ', l1Gateway.address)
  await l2Gateway.init(l1Gateway.address, ZERO_GAS_OPTS)

  // Governance deploy
  const l2GovernanceRelay = await deployContract<L2GovernanceRelay>(
    l2Deployer,
    await getL2Factory('L2GovernanceRelay'),
    [L2_XDOMAIN_MESSENGER],
  )
  console.log('L2 Governance Relay: ', l2Gateway.address)
  const l1GovernanceRelay = await deployContract<L1GovernanceRelay>(
    deployer,
    await l1.getContractFactory('L1GovernanceRelay'),
    [l2GovernanceRelay.address, ZERO_ADDRESS],
  )
  console.log('L1 Governance Relay: ', l1Gateway.address)
  await l2GovernanceRelay.init(l1GovernanceRelay.address, ZERO_GAS_OPTS)

  // Permissions
  console.log('Finalizing permissions for L1Escrow...')
  await l1Escrow.connect(deployer).approve(L1_DAI_ADDRESS, l1Gateway.address, MAX_UINT256)
  await l1Escrow.connect(deployer).rely(L1_PAUSE_PROXY_ADDRESS)
  await l1Escrow.connect(deployer).rely(L1_ESM_ADDRESS)
  await l1Escrow.connect(deployer).deny(deployer._address)
  console.log('Finalizing permissions for L2 DAI...')
  await l2Dai.rely(l2Gateway.address, ZERO_GAS_OPTS)
  await l2Dai.rely(l2GovernanceRelay.address, ZERO_GAS_OPTS)
  await l2Dai.deny(l2Deployer.address, ZERO_GAS_OPTS)
  console.log('Finalizing permissions for L2 Gateway...')
  await l2Gateway.transferOwnership(l2GovernanceRelay.address, ZERO_GAS_OPTS)
  console.log('Finalizing permissions for L1 governance relay...')
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
