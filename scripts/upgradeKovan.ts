require('dotenv').config()
import { JsonRpcProvider } from '@ethersproject/providers'
import { expect } from 'chai'
import hre from 'hardhat'
import { ethers as l1 } from 'hardhat'
import { assert } from 'ts-essentials'

import { getAddressOfNextDeployedContract } from '../test-e2e/helpers/address'
import { deployUsingFactory, getL2Factory, ZERO_GAS_OPTS } from '../test-e2e/helpers/utils'

const L1_PAUSE_PROXY_ADDRESS = '0x0e4725db88Bb038bBa4C4723e91Ba183BE11eDf3'
const L1_ESM_ADDRESS = '0xD5D728446275B0A12E4a4038527974b92353B4a9'
const L1_DAI_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'
assert(process.env.KOVAN_DEPLOYER_PRIV_KEY, 'Please provide KOVAN_DEPLOYER_PRIV_KEY in .env file')
const L1_DEPLOYER_PRIV_KEY = process.env.KOVAN_DEPLOYER_PRIV_KEY
const L1_XDOMAIN_MESSENGER = '0x4361d0F75A0186C05f971c566dC6bEa5957483fD'
const L1_RPC_URL = 'https://parity0.kovan.makerfoundation.com:8545'
assert(process.env.L2_TESTNET_DEPLOYER_PRIV_KEY, 'Please provide L2_TESTNET_DEPLOYER_PRIV_KEY in .env file')
const L2_DEPLOYER_PRIV_KEY = process.env.L2_TESTNET_DEPLOYER_PRIV_KEY
const L2_RPC_URL = 'https://kovan.optimism.io/'
const L2_XDOMAIN_MESSENGER = '0x4200000000000000000000000000000000000007'
const L2_DAI_ADDRESS = '0x8b4E5Ab8c90AF4FBCB8a71A86bdC340d9151c96d'
const L1_ESCROW_ADDRESS = '0x42cE949bda03A1B9e8785a6005C9A18DfdBf5037'
const L1_GOV_RELAY_ADDRESS = '0x675383242Dbc07C8e130393037aa4C40cb06e1F3'

async function main() {
  hre.network
  console.log('Deploying on kovan')
  const l1Provider = new JsonRpcProvider(L1_RPC_URL)
  const l1Deployer = new hre.ethers.Wallet(L1_DEPLOYER_PRIV_KEY, l1Provider)

  const l2Provider = new JsonRpcProvider(L2_RPC_URL)
  const l2Deployer = new hre.ethers.Wallet(L2_DEPLOYER_PRIV_KEY, l2Provider)

  const opts = {
    l1Deployer: l1Deployer,
    l2Deployer: l2Deployer,
    L1_DAI_ADDRESS,
    L1_PAUSE_PROXY_ADDRESS,
    L1_ESM_ADDRESS,
    L2_XDOMAIN_MESSENGER,
    L1_XDOMAIN_MESSENGER,
    L2_DAI_ADDRESS,
    L1_ESCROW_ADDRESS,
    L1_GOV_RELAY_ADDRESS,
    L1_TX_OPTS: {
      gasPrice: 3000000000, // 3 gwei
    },
    L2_TX_OPTS: ZERO_GAS_OPTS,
  }

  const futureL1DAITokenBridgeAddress = await getAddressOfNextDeployedContract(opts.l1Deployer)
  const l2DAITokenBridge = await deployUsingFactory(opts.l2Deployer, await getL2Factory('L2DAITokenBridge'), [
    opts.L2_XDOMAIN_MESSENGER,
    opts.L2_DAI_ADDRESS,
    opts.L1_DAI_ADDRESS,
    futureL1DAITokenBridgeAddress,
    opts.L2_TX_OPTS,
  ])
  console.log('L2DAITokenBridge: ', l2DAITokenBridge.address)
  const l1DAITokenBridge = await deployUsingFactory(opts.l1Deployer, await l1.getContractFactory('L1DAITokenBridge'), [
    opts.L1_DAI_ADDRESS,
    l2DAITokenBridge.address,
    L2_DAI_ADDRESS,
    opts.L1_XDOMAIN_MESSENGER,
    L1_ESCROW_ADDRESS,
    opts.L1_TX_OPTS,
  ])
  console.log('L1DAITokenBridge: ', l1DAITokenBridge.address)
  expect(futureL1DAITokenBridgeAddress).to.be.eq(
    l1DAITokenBridge.address,
    'Predicted address of l1DAITokenBridge doesnt match actual address',
  )

  const l2Spell = await deployUsingFactory(opts.l2Deployer, await getL2Factory('L2KovanUpgradeSpell'), [
    opts.L2_DAI_ADDRESS,
    l2DAITokenBridge.address,
    opts.L2_TX_OPTS,
  ])
  console.log('l2Spell', l2Spell.address)
}

main()
  .then(() => console.log('DONE'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
