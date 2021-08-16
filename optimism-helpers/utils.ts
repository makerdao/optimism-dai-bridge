import { ethers, providers } from 'ethers'
import { readFileSync } from 'fs'
import { artifacts as hhArtifacts } from 'hardhat'
import hh from 'hardhat'
import { join } from 'path'
import { assert } from 'ts-essentials'

import { artifacts } from './artifacts'
import { optimismConfig } from './optimismConfig'

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

export const getL2Factory: typeof hh.ethers.getContractFactory = async function getL2Factory(name: string) {
  const l1ArtifactPaths = await hhArtifacts.getArtifactPaths()
  const desiredArtifacts = l1ArtifactPaths.filter((a) => a.endsWith(`/${name}.json`))
  assert(desiredArtifacts.length === 1, "Couldn't find desired artifact or found too many")

  const l1ArtifactPath = desiredArtifacts[0]
  const artifactRootPath = join(__dirname, '../artifacts')
  const artifactOvmRootPath = join(__dirname, '../artifacts-ovm')
  assert(l1ArtifactPath.indexOf(artifactRootPath) !== -1, 'Cant rewrite the l1 -> l2 artifact path')
  const l2ArtifactPath = l1ArtifactPath.replace(artifactRootPath, artifactOvmRootPath)

  const artifact = JSON.parse(readFileSync(l2ArtifactPath, 'utf-8'))

  return new ethers.ContractFactory(artifact.abi, artifact.bytecode)
} as any
