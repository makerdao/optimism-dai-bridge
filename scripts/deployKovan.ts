/**
 * Full kovan deploy including any permissions that need to be set.
 */
require('dotenv').config()
import hre from 'hardhat'
import { deploy } from './common'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ZERO_GAS_OPTS } from '../test-e2e/helpers/utils'
import { assert } from 'ts-essentials'

// optimism's addresses: https://github.com/ethereum-optimism/optimism/tree/master/packages/contracts/deployments

const L1_PAUSE_PROXY_ADDRESS = '0x0e4725db88Bb038bBa4C4723e91Ba183BE11eDf3'
const L1_ESM_ADDRESS = '0xD5D728446275B0A12E4a4038527974b92353B4a9'
const L1_DAI_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'
assert(process.env.KOVAN_DEPLOYER_PRIV_KEY, 'Please provide KOVAN_DEPLOYER_PRIV_KEY in .env file')
const L1_DEPLOYER_PRIV_KEY = process.env.KOVAN_DEPLOYER_PRIV_KEY
const L1_XDOMAIN_MESSENGER = '0x78b88FD62FBdBf67b9C5C6528CF84E9d30BB28e0'
const L1_RPC_URL = 'https://parity0.kovan.makerfoundation.com:8545'
assert(process.env.L2_TESTNET_DEPLOYER_PRIV_KEY, 'Please provide L2_TESTNET_DEPLOYER_PRIV_KEY in .env file')
const L2_DEPLOYER_PRIV_KEY = process.env.L2_TESTNET_DEPLOYER_PRIV_KEY
const L2_RPC_URL = 'https://kovan.optimism.io/'
const L2_XDOMAIN_MESSENGER = '0x4200000000000000000000000000000000000007'

async function main() {
  console.log('Deploying on kovan')
  const l1Provider = new JsonRpcProvider(L1_RPC_URL)
  const l1Deployer = new hre.ethers.Wallet(L1_DEPLOYER_PRIV_KEY, l1Provider)

  const l2Provider = new JsonRpcProvider(L2_RPC_URL)
  const l2Deployer = new hre.ethers.Wallet(L2_DEPLOYER_PRIV_KEY, l2Provider)

  await deploy({
    l1Deployer: l1Deployer,
    l2Deployer: l2Deployer,
    L1_DAI_ADDRESS,
    L1_PAUSE_PROXY_ADDRESS,
    L1_ESM_ADDRESS,
    L2_XDOMAIN_MESSENGER,
    L1_XDOMAIN_MESSENGER,
    L1_TX_OPTS: {
      gasPrice: 3000000000, // 3 gwei
    },
    L2_TX_OPTS: ZERO_GAS_OPTS,
  })
}

main()
  .then(() => console.log('DONE'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
