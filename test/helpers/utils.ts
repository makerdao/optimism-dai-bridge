import { Contract, ethers, providers, Signer, Wallet } from 'ethers'

import { artifacts } from './artifacts'
import { getL1Provider } from './l1'
import { getL2Provider } from './l2'
import { optimismConfig } from './optimismConfig'
import { connectWallets, getAdminWallet, getRandomWallets } from './wallets'

export function q18(n: number) {
  return ethers.BigNumber.from(10).pow(18).mul(n).toString()
}

export const DUMMY_ADDRESS = '0x' + '1234'.repeat(10)

export async function waitToRelayTxsToL2(l1Provider: providers.BaseProvider) {
  console.log('Waiting to relay txs to L2...')

  const CTC = new ethers.Contract(
    optimismConfig.OVM_CanonicalTransactionChain,
    artifacts.l1.canonicalTxChain.abi,
    l1Provider,
  )

  await retry(async () => {
    const ctcQueuedElement = await CTC.getNumPendingQueueElements()

    if (ctcQueuedElement > 0) {
      throw new Error('Queue not empty!')
    }
  })
  console.log('All txs relayed!')
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

export async function retry<T>(fn: () => Promise<T>) {
  let retries = 0
  let lastError

  while (retries++ < 60) {
    try {
      await fn()
      return
    } catch (e) {
      lastError = e
      await sleep(1000)
    }
  }

  throw lastError
}

async function sleep(n: number) {
  return new Promise((resolve) => {
    setInterval(resolve, n)
  })
}

export async function deployContract(signer: Signer, artifact: any, args: any[] = []): Promise<Contract> {
  const contractFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer)
  const contractDeployed = await contractFactory.deploy(...args)

  await contractDeployed.deployed()

  return contractDeployed
}

export async function waitForTx(tx: Promise<any>): Promise<any> {
  const resolvedTx = await tx
  return await resolvedTx.wait()
}

export async function setupTest(): Promise<{
  l1Provider: providers.BaseProvider
  l2Provider: providers.BaseProvider
  l1Signer: Wallet
  l2Signer: Wallet
}> {
  const randomWallets = getRandomWallets(3)

  const l1Provider = getL1Provider()
  const l1Admin = getAdminWallet().connect(l1Provider)
  const [l1Deployer] = connectWallets(randomWallets, l1Provider)

  const l2Provider = getL2Provider()
  const [l2Deployer] = connectWallets(randomWallets, l2Provider)

  console.log('Seeding L1 account')
  await waitForTx(l1Admin.sendTransaction({ value: ethers.utils.parseEther('1'), to: l1Deployer.address }))

  return {
    l1Provider,
    l2Provider,
    l1Signer: l1Deployer,
    l2Signer: l2Deployer,
  }
}
