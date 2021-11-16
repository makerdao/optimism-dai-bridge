import { Watcher } from '@eth-optimism/core-utils'
import { getMessagesAndProofsForL2Transaction } from '@eth-optimism/message-relayer'
import { ethers, providers, Signer } from 'ethers'

import { getL1Url, getL2Url } from '.'
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

// manually relies L2 -> L1 messages as dockerized optimism doesnt do it anymore
export async function relayMessagesToL1(l2OriginatingTx: Promise<any>, watcher: Watcher, l1Signer: Signer) {
  console.log('Using watcher to wait for L2->L1 relay...')
  const res = await l2OriginatingTx
  await res.wait()

  const [l2ToL1XDomainMsgHash] = await watcher.getMessageHashesFromL2Tx(res.hash)
  console.log(`Found cross-domain message ${l2ToL1XDomainMsgHash} in L2 tx.  Waiting for relay to L1...`)

  await relayMessages(l1Signer, res.hash)
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

export async function relayMessages(l1Deployer: Signer, l2TxHash: string) {
  const messagePairs = await retry(
    () =>
      getMessagesAndProofsForL2Transaction(
        getL1Url(),
        getL2Url(),
        optimismConfig.StateCommitmentChain,
        optimismConfig._L2_OVM_L2CrossDomainMessenger,
        l2TxHash,
      ),
    15,
  )
  const l1XdomainMessenger = new ethers.Contract(
    optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
    artifacts.l1.crossDomainMessenger.abi,
    l1Deployer,
  )
  for (const { message, proof } of messagePairs) {
    console.log('Relaying  L2 -> L1 message...')
    await l1XdomainMessenger.relayMessage(message.target, message.sender, message.message, message.messageNonce, proof)
  }
}

function delay(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration))
}

async function retry<T>(fn: () => Promise<T>, maxRetries: number = 5): Promise<T> {
  const sleepBetweenRetries = 1000
  let retryCount = 0

  do {
    try {
      return await fn()
    } catch (error) {
      const isLastAttempt = retryCount === maxRetries
      if (isLastAttempt) {
        throw error
      }
      console.log('retry...')
    }
    await delay(sleepBetweenRetries)
  } while (retryCount++ < maxRetries)

  throw new Error('Unreachable')
}
