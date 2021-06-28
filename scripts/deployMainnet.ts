/**
 * Full mainnet deploy including any permissions that need to be set.
 * Uses forked mainnat as L1, and kovan optimism rollup as L2.
 * In such setup xchain messages doesn't work.
 */
require('dotenv').config()
import { JsonRpcProvider } from '@ethersproject/providers'
import hre from 'hardhat'
import { mapValues } from 'lodash'

import { ZERO_GAS_OPTS } from '../test-e2e/helpers/utils'
import { deploy, getRequiredEnv } from './common'

const L1_MAINNET_RPC_URL = getRequiredEnv('L1_MAINNET_RPC_URL')
const L1_MAINNET_DEPLOYER_PRIV_KEY = getRequiredEnv('L1_MAINNET_DEPLOYER_PRIV_KEY')
const L2_MAINNET_RPC_URL = getRequiredEnv('L2_MAINNET_RPC_URL')
const L2_MAINNET_DEPLOYER_PRIV_KEY = getRequiredEnv('L2_MAINNET_DEPLOYER_PRIV_KEY')

const L1_MAINNET_PAUSE_PROXY_ADDRESS = '0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB'
const L1_MAINNET_ESM_ADDRESS = '0x29CfBd381043D00a98fD9904a431015Fef07af2f'
const L1_MAINNET_DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const L1_MAINNET_XDOMAIN_MESSENGER = '0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1'
const L2_MAINNET_XDOMAIN_MESSENGER = '0x4200000000000000000000000000000000000007'

async function main() {
  console.log('Deploying on mainnet')
  const l1Provider = new JsonRpcProvider(L1_MAINNET_RPC_URL)
  const l1Deployer = new hre.ethers.Wallet(L1_MAINNET_DEPLOYER_PRIV_KEY, l1Provider)

  const l2Provider = new JsonRpcProvider(L2_MAINNET_RPC_URL)
  const l2Deployer = new hre.ethers.Wallet(L2_MAINNET_DEPLOYER_PRIV_KEY, l2Provider)

  const deploymentInfo = await deploy({
    desiredL2DaiAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    l1Deployer: l1Deployer,
    l2Deployer: l2Deployer,
    L1_DAI_ADDRESS: L1_MAINNET_DAI_ADDRESS,
    L1_PAUSE_PROXY_ADDRESS: L1_MAINNET_PAUSE_PROXY_ADDRESS,
    L1_ESM_ADDRESS: L1_MAINNET_ESM_ADDRESS,
    L1_XDOMAIN_MESSENGER: L1_MAINNET_XDOMAIN_MESSENGER,
    L2_XDOMAIN_MESSENGER: L2_MAINNET_XDOMAIN_MESSENGER,
    L1_TX_OPTS: {},
    L2_TX_OPTS: ZERO_GAS_OPTS,
  })

  const allContractInfo = {
    l1Dai: L1_MAINNET_DAI_ADDRESS,
    ...mapValues(deploymentInfo, (v) => v.address),
  }

  console.log(JSON.stringify(allContractInfo, null, 2))
}

main()
  .then(() => console.log('DONE'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
