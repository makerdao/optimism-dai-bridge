import { Watcher } from '@eth-optimism/core-utils'
import { ethers, providers } from 'ethers'

import { artifacts } from './artifacts'
import { optimismConfig } from './optimismConfig'

export const ZERO_GAS_OPTS = { gasPrice: 0 }

export async function waitToRelayTxsToL2(l1OriginatingTx: Promise<any>, watcher: Watcher) {
  console.log('Using watcher to wait for L1->L2 relay...')
  const res = await l1OriginatingTx
  await res.wait()

  const [l2ToL1XDomainMsgHash] = await watcher.getMessageHashesFromL1Tx(res.hash)
  console.log(`Found cross-domain message ${l2ToL1XDomainMsgHash} in L1 tx.  Waiting for relay to L2...`)
  await watcher.getL2TransactionReceipt(l2ToL1XDomainMsgHash)
}

// uses eth-optimism watcher tool to pick up events on both chains
export async function waitToRelayMessageToL1(l2OriginatingTx: Promise<any>, watcher: Watcher) {
  console.log('Using watcher to wait for L2->L1 relay...')
  const res = await l2OriginatingTx
  await res.wait()

  const [l2ToL1XDomainMsgHash] = await watcher.getMessageHashesFromL2Tx(res.hash)
  console.log(`Found cross-domain message ${l2ToL1XDomainMsgHash} in L2 tx.  Waiting for relay to L1...`)
  await watcher.getL1TransactionReceipt(l2ToL1XDomainMsgHash)
}

export async function printRollupStatus(l1Provider: providers.BaseProvider) {
  const CTC = new ethers.Contract(
    optimismConfig.CanonicalTransactionChain,
    artifacts.l1.canonicalTxChain.abi,
    l1Provider,
  )
  const STC = new ethers.Contract(
    optimismConfig.StateCommitmentChain,
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
