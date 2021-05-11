/**
 * Full kovan deploy including any permissions that need to be set.
 */
import hre from 'hardhat'
import { deploy } from './common'
import { JsonRpcProvider } from '@ethersproject/providers'
import { ZERO_GAS_OPTS } from '../test-e2e/helpers/utils'

// optimism list of addresses: https://github.com/ethereum-optimism/optimism/tree/master/packages/contracts/deployments

const L1_PAUSE_PROXY_ADDRESS = '0x0e4725db88Bb038bBa4C4723e91Ba183BE11eDf3'
const L1_ESM_ADDRESS = '0xD5D728446275B0A12E4a4038527974b92353B4a9'
const L1_DAI_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'
// address: 0xFF2Bd97cEfd97287f1aAbA63BC5c243bb20Cf4A0
const L1_DEPLOYER_PRIV_KEY = '89142aa5330b9f1db2901ab302a4589c2a973ae2a48a53e45bb08cc265febce2' // random address with some funds on kovan
const L1_XDOMAIN_MESSENGER = '0x48062eD9b6488EC41c4CfbF2f568D7773819d8C9'
const L1_RPC_URL = 'https://parity0.kovan.makerfoundation.com:8545'
const L2_DEPLOYER_PRIV_KEY = '6ea93392eb84fad521111def2e8fbd9c45c2b085907797e1a60a210d5bf7089d' // random empty address (l2 has no gas fees ATM)
const L2_RPC_URL = 'https://kovan.optimism.io/'
const L2_XDOMAIN_MESSENGER = '0x4200000000000000000000000000000000000007'

async function main() {
  console.log('Deploying on kovan')
  const { ethers: l1 } = hre
  const l1Provider = new JsonRpcProvider(L1_RPC_URL)
  const l1Deployer = new hre.ethers.Wallet(L1_DEPLOYER_PRIV_KEY, l1Provider)

  const l2Provider = new JsonRpcProvider(L2_RPC_URL)
  const l2Deployer = new hre.ethers.Wallet(L2_DEPLOYER_PRIV_KEY, l2Provider)

  await deploy({
    l1: l1,
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
