import { Watcher } from '@eth-optimism/watcher'
import { assert } from 'console'
import { ContractFactory, ethers, providers, Signer, Wallet } from 'ethers'
import { readFileSync } from 'fs'
import { artifacts as hhArtifacts } from 'hardhat'
import hh from 'hardhat'
import { join } from 'path'

import { artifacts } from './artifacts'
import { getL1Provider } from './l1'
import { getL2Provider } from './l2'
import { optimismConfig } from './optimismConfig'
import { connectWallets, getAdminWallet, getRandomWallets } from './wallets'

export function q18(n: number) {
  return ethers.BigNumber.from(10).pow(18).mul(n).toString()
}

export const MAX_UINT256 = ethers.BigNumber.from(2).pow(256).sub(1)

export const DUMMY_ADDRESS = '0x' + '1234'.repeat(10)

export const ZERO_GAS_OPTS = { gasPrice: 0 }

export async function waitToRelayTxsToL2(l1OriginatingTx: Promise<any>, watcher: any) {
  console.log('Using watcher to wait for L1->L2 relay...')
  const res = await l1OriginatingTx
  await res.wait()

  const [l2ToL1XDomainMsgHash] = await watcher.getMessageHashesFromL1Tx(res.hash)
  console.log(`Found cross-domain message ${l2ToL1XDomainMsgHash} in L1 tx.  Waiting for relay to L2...`)
  await watcher.getL2TransactionReceipt(l2ToL1XDomainMsgHash)
}

// uses eth-optimism watcher tool to pick up events on both chains
export async function waitToRelayMessageToL1(l2OriginatingTx: Promise<any>, watcher: any) {
  console.log('Using watcher to wait for L2->L1 relay...')
  const res = await l2OriginatingTx
  await res.wait()

  const [l2ToL1XDomainMsgHash] = await watcher.getMessageHashesFromL2Tx(res.hash)
  console.log(`Found cross-domain message ${l2ToL1XDomainMsgHash} in L2 tx.  Waiting for relay to L1...`)
  await watcher.getL1TransactionReceipt(l2ToL1XDomainMsgHash)
}

export async function printRollupStatus(l1Provider: providers.BaseProvider) {
  const CTC = new ethers.Contract(
    optimismConfig.OVM_CanonicalTransactionChain,
    artifacts.l1.canonicalTxChain.abi,
    l1Provider,
  )
  const STC = new ethers.Contract(
    optimismConfig.OVM_StateCommitmentChain,
    artifacts.l1.stateCommitmentChain.abi,
    l1Provider,
  )

  const ctcAllElements = await CTC.getTotalElements()
  const ctcQueuedElement = await CTC.getNumPendingQueueElements()
  const stcAllElements = await STC.getTotalElements()

  console.log('Canonical Tx Chain all elements: ', ctcAllElements.toString())
  console.log('Canonical Tx Chain queued elements: ', ctcQueuedElement.toString())
  console.log('State Commitment Chain all elements: ', stcAllElements.toString())
}

export async function deployUsingFactory<T extends ContractFactory>(
  signer: Signer,
  factory: T,
  args?: Parameters<T['deploy']>,
): Promise<ReturnType<T['deploy']>> {
  const contractFactory = new ethers.ContractFactory(factory.interface, factory.bytecode, signer)
  const contractDeployed = await contractFactory.deploy(...(args || []))

  await contractDeployed.deployed()

  return contractDeployed as any
}

export async function waitForTx(tx: Promise<any>): Promise<any> {
  const resolvedTx = await tx
  return await resolvedTx.wait()
}

export async function setupTest(): Promise<{
  l1Provider: providers.BaseProvider
  l2Provider: providers.BaseProvider
  l1Signer: Wallet
  l1User: Wallet
  l2Signer: Wallet
  watcher: any
}> {
  const randomWallets = getRandomWallets(3)

  const l1Provider = getL1Provider()
  const l1Admin = getAdminWallet().connect(l1Provider)
  const [l1Deployer, l1User] = connectWallets(randomWallets, l1Provider)

  const l2Provider = getL2Provider()
  const [l2Deployer] = connectWallets(randomWallets, l2Provider)

  console.log('Seeding L1 account')
  await waitForTx(l1Admin.sendTransaction({ value: ethers.utils.parseEther('1'), to: l1Deployer.address }))
  await waitForTx(l1Admin.sendTransaction({ value: ethers.utils.parseEther('1'), to: l1User.address }))

  const watcher = new Watcher({
    l1: {
      provider: l1Provider,
      messengerAddress: optimismConfig.Proxy__OVM_L1CrossDomainMessenger, // this sits behind a proxy right now
    },
    l2: {
      provider: l2Provider,
      messengerAddress: optimismConfig._L2_OVM_L2CrossDomainMessenger,
    },
  })

  return {
    l1Provider,
    l2Provider,
    l1Signer: l1Deployer,
    l1User,
    l2Signer: l2Deployer,
    watcher,
  }
}

export const getL2Factory: typeof hh.ethers.getContractFactory = async function getL2Factory(name: string) {
  const l1ArtifactPaths = await hhArtifacts.getArtifactPaths()
  const desiredArtifacts = l1ArtifactPaths.filter((a) => a.endsWith(`/${name}.json`))
  assert(desiredArtifacts.length === 1, "Couldn't find desired artifact or found too many")

  const l1ArtifactPath = desiredArtifacts[0]
  const artifactRootPath = join(__dirname, '../../artifacts')
  const artifactOvmRootPath = join(__dirname, '../../artifacts-ovm')
  const l2ArtifactPath = l1ArtifactPath.replace(artifactRootPath, artifactOvmRootPath)

  const artifact = JSON.parse(readFileSync(l2ArtifactPath, 'utf-8'))

  return new ethers.ContractFactory(artifact.abi, artifact.bytecode)
} as any
