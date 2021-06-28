/**
 * Full kovan deploy including any permissions that need to be set.
 */
require('dotenv').config()
import { JsonRpcProvider } from '@ethersproject/providers'
import hre from 'hardhat'
import { mapValues } from 'lodash'

import { ZERO_GAS_OPTS } from '../test-e2e/helpers/utils'
import { deploy, getRequiredEnv } from './common'

// optimism's addresses: https://github.com/ethereum-optimism/optimism/tree/master/packages/contracts/deployments

const L1_KOVAN_RPC_URL = getRequiredEnv('L1_KOVAN_RPC_URL')
const L1_KOVAN_DEPLOYER_PRIV_KEY = getRequiredEnv('L1_KOVAN_DEPLOYER_PRIV_KEY')
const L2_KOVAN_RPC_URL = getRequiredEnv('L2_KOVAN_RPC_URL')
const L2_KOVAN_DEPLOYER_PRIV_KEY = getRequiredEnv('L2_KOVAN_DEPLOYER_PRIV_KEY')

const L1_KOVAN_PAUSE_PROXY_ADDRESS = '0x0e4725db88Bb038bBa4C4723e91Ba183BE11eDf3'
const L1_KOVAN_ESM_ADDRESS = '0xD5D728446275B0A12E4a4038527974b92353B4a9'
const L1_KOVAN_DAI_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'
const L1_KOVAN_XDOMAIN_MESSENGER = '0x4361d0F75A0186C05f971c566dC6bEa5957483fD'
const L2_KOVAN_XDOMAIN_MESSENGER = '0x4200000000000000000000000000000000000007'

async function main() {
  console.log('Deploying on kovan')
  const l1Provider = new JsonRpcProvider(L1_KOVAN_RPC_URL)
  const l1Deployer = new hre.ethers.Wallet(L1_KOVAN_DEPLOYER_PRIV_KEY, l1Provider)

  const l2Provider = new JsonRpcProvider(L2_KOVAN_RPC_URL)
  const l2Deployer = new hre.ethers.Wallet(L2_KOVAN_DEPLOYER_PRIV_KEY, l2Provider)

  const deploymentInfo = await deploy({
    desiredL2DaiAddress: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    l1Deployer: l1Deployer,
    l2Deployer: l2Deployer,
    L1_DAI_ADDRESS: L1_KOVAN_DAI_ADDRESS,
    L1_PAUSE_PROXY_ADDRESS: L1_KOVAN_PAUSE_PROXY_ADDRESS,
    L1_ESM_ADDRESS: L1_KOVAN_ESM_ADDRESS,
    L2_XDOMAIN_MESSENGER: L2_KOVAN_XDOMAIN_MESSENGER,
    L1_XDOMAIN_MESSENGER: L1_KOVAN_XDOMAIN_MESSENGER,
    L1_TX_OPTS: {
      gasPrice: 3000000000, // 3 gwei
    },
    L2_TX_OPTS: ZERO_GAS_OPTS,
  })

  const allContractInfo = {
    l1Dai: L1_KOVAN_DAI_ADDRESS,
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
