/**
 * Full mainnet deploy including any permissions that need to be set.
 * Uses forked mainnat as L1, and kovan optimism rollup as L2.
 * In such setup xchain messages doesn't work.
 */
require('dotenv').config()
import hre from 'hardhat'
import { JsonRpcProvider } from '@ethersproject/providers'
import { deploy } from './common'
import { ZERO_GAS_OPTS } from '../test-e2e/helpers/utils'
import { assert } from 'ts-essentials'

const L1_PAUSE_PROXY_ADDRESS = '0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB'
const L1_ESM_ADDRESS = '0x29CfBd381043D00a98fD9904a431015Fef07af2f'
const L1_DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const L1_DEPLOYER_ADDRESS = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
const L2_XDOMAIN_MESSENGER = '0x4200000000000000000000000000000000000007'
assert(process.env.L2_TESTNET_DEPLOYER_PRIV_KEY, 'Please provide L2_TESTNET_DEPLOYER_PRIV_KEY in .env file')
const L2_DEPLOYER_PRIV_KEY = process.env.L2_TESTNET_DEPLOYER_PRIV_KEY
const L2_RPC_URL = 'https://kovan.optimism.io/'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

async function main() {
  console.log('Deploying on mainnet')
  const { ethers: l1 } = hre
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [L1_DEPLOYER_ADDRESS],
  })
  const deployer = hre.ethers.provider.getSigner(L1_DEPLOYER_ADDRESS)

  const l2Provider = new JsonRpcProvider(L2_RPC_URL)
  const l2Deployer = new hre.ethers.Wallet(L2_DEPLOYER_PRIV_KEY, l2Provider)

  await deploy({
    l1: l1,
    l1Deployer: deployer,
    l2Deployer: l2Deployer,
    L1_DAI_ADDRESS,
    L1_PAUSE_PROXY_ADDRESS,
    L1_ESM_ADDRESS,
    L2_XDOMAIN_MESSENGER,
    L1_XDOMAIN_MESSENGER: ZERO_ADDRESS, // not deployed on forked mainnet for now
    L1_TX_OPTS: ZERO_GAS_OPTS,
    L2_TX_OPTS: ZERO_GAS_OPTS,
  })
}

main()
  .then(() => console.log('DONE'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
