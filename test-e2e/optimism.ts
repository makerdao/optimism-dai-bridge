import { getMessagesAndProofsForL2Transaction } from '@eth-optimism/message-relayer'
import { Contract, ContractTransaction, Signer } from 'ethers'

import { optimismConfig } from '../optimism-helpers'
const l1XDomainMessengerArtifact = require('@eth-optimism/contracts/artifacts-ovm/contracts/optimistic-ethereum/OVM/bridge/messaging/OVM_L1CrossDomainMessenger.sol/OVM_L1CrossDomainMessenger.json')

type CrossDomainMessagePair = ReturnType<typeof getMessagesAndProofsForL2Transaction>

export async function getL2ToL1Messages(tx: Promise<ContractTransaction>): Promise<CrossDomainMessagePair> {
  const receipt = await (await tx).wait()

  console.log('Giving some time for state batch to udpate on L1...') // @todo this could be replaced with explicit while loop and checking l1 status
  await sleep(5000)

  const messagePairs = await getMessagesAndProofsForL2Transaction(
    'http://localhost:9545',
    'http://localhost:8545',
    optimismConfig.OVM_StateCommitmentChain,
    optimismConfig._L2_OVM_L2CrossDomainMessenger,
    receipt.transactionHash,
  )

  return messagePairs
}

export async function relayMessageToL1(tx: Promise<ContractTransaction>, l1Signer: Signer) {
  const messagePairs = await getL2ToL1Messages(tx)

  const l1XDomainMessenger = new Contract(
    optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
    l1XDomainMessengerArtifact.abi,
    l1Signer,
  )

  for (const { message, proof } of messagePairs) {
    console.log(`relaying message: ${message.messageNonce}`)
    const result = await l1XDomainMessenger.relayMessage(
      message.target,
      message.sender,
      message.message,
      message.messageNonce,
      proof,
    )

    await result.wait()
    console.log(`relayed message ${message.messageNonce}! L1 tx hash: ${result.hash}`)
  }
}

function sleep(n: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, n)
  })
}
