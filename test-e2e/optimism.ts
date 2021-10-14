import { BigNumber, Contract, ContractTransaction, Signer, utils } from 'ethers'
import { optimismConfig } from '../optimism-helpers'
import { providers } from 'ethers'
const l2XDomainMessengerArtifact = require('@eth-optimism/contracts/artifacts-ovm/contracts/optimistic-ethereum/OVM/bridge/messaging/OVM_L2CrossDomainMessenger.sol/OVM_L2CrossDomainMessenger.json')

export async function relayMessageToL1(tx: Promise<ContractTransaction>, l2Signer: Signer) {
  const receipt = await (await tx).wait()

  const beginBlock = receipt.blockNumber
  const endBlock = receipt.blockNumber
  const l2CrossDomainMessenger = new Contract(
    optimismConfig._L2_OVM_L2CrossDomainMessenger,
    l2XDomainMessengerArtifact.abi,
    l2Signer,
  )

  const messages = await observeMessages(l2CrossDomainMessenger, beginBlock, endBlock)
  console.log('Found ', messages.length)
  debugger
}

export interface SentMessage {
  target: string
  sender: string
  message: string
  messageNonce: number
  encodedMessage: string
  encodedMessageHash: string
  parentTransactionIndex: number
  parentTransactionHash: string
}

export interface StateRootBatchHeader {
  batchIndex: BigNumber
  batchRoot: string
  batchSize: BigNumber
  prevTotalElements: BigNumber
  extraData: string
}

export interface StateRootProof {
  index: number
  siblings: string[]
}

export interface SentMessageProof {
  stateRoot: string
  stateRootBatchHeader: StateRootBatchHeader
  stateRootProof: StateRootProof
  stateTrieWitness: string | Buffer
  storageTrieWitness: string | Buffer
}

const l2BlockOffset = 1

async function observeMessages(
  OVM_L2CrossDomainMessenger: Contract,
  startHeight: number,
  endHeight: number,
): Promise<SentMessage[]> {
  const filter = OVM_L2CrossDomainMessenger.filters.SentMessage()
  const events = await OVM_L2CrossDomainMessenger.queryFilter(filter, startHeight, endHeight)

  return events.map((event: any) => {
    const message = event.args.message
    const decoded = OVM_L2CrossDomainMessenger.interface.decodeFunctionData('relayMessage', message)

    return {
      target: decoded._target,
      sender: decoded._sender,
      message: decoded._message,
      messageNonce: decoded._messageNonce,
      encodedMessage: message,
      encodedMessageHash: utils.keccak256(message),
      parentTransactionIndex: event.blockNumber - l2BlockOffset,
      parentTransactionHash: event.transactionHash,
    }
  })
}

async function getMessageProof(
  message: SentMessage,
  OVM_L2CrossDomainMessenger: Contract,
  OVM_L2ToL1MessagePasser: Contract,
  l2Provider: providers.JsonRpcProvider,
): Promise<SentMessageProof> {
  const messageSlot = utils.keccak256(
    utils.keccak256(message.encodedMessage + OVM_L2CrossDomainMessenger.address.slice(2)) + '00'.repeat(32),
  )

  // TODO: Complain if the proof doesn't exist.
  const proof = await l2Provider.send('eth_getProof', [
    OVM_L2ToL1MessagePasser.address,
    [messageSlot],
    '0x' +
      BigNumber.from(message.parentTransactionIndex + l2BlockOffset)
        .toHexString()
        .slice(2)
        .replace(/^0+/, ''),
  ])

  // TODO: Complain if the batch doesn't exist.
  const header = await this._getStateBatchHeader(message.parentTransactionIndex)

  const elements = []
  for (let i = 0; i < Math.pow(2, Math.ceil(Math.log2(header.stateRoots.length))); i++) {
    if (i < header.stateRoots.length) {
      elements.push(header.stateRoots[i])
    } else {
      elements.push(ethers.utils.keccak256('0x' + '00'.repeat(32)))
    }
  }

  const hash = (el: Buffer | string): Buffer => {
    return Buffer.from(ethers.utils.keccak256(el).slice(2), 'hex')
  }

  const leaves = elements.map((element) => {
    return fromHexString(element)
  })

  const tree = new MerkleTree(leaves, hash)
  const index = message.parentTransactionIndex - header.batch.prevTotalElements.toNumber()
  const treeProof = tree.getProof(leaves[index], index).map((element) => {
    return element.data
  })

  return {
    stateRoot: header.stateRoots[index],
    stateRootBatchHeader: header.batch,
    stateRootProof: {
      index,
      siblings: treeProof,
    },
    stateTrieWitness: rlp.encode(proof.accountProof),
    storageTrieWitness: rlp.encode(proof.storageProof[0].proof),
  }
}
