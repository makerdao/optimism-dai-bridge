import { Watcher } from '@eth-optimism/core-utils'
import { connectWallets, getRandomWallets, waitForTx } from '@makerdao/hardhat-utils'
import { ethers, providers, Wallet } from 'ethers'

import { getL1Provider, getL2Provider, optimismConfig } from '../optimism-helpers'

export function getAdminWallet(): Wallet {
  return new Wallet('0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e')
}

export async function setupTest(): Promise<{
  l1Provider: providers.BaseProvider
  l2Provider: providers.BaseProvider
  l1Signer: Wallet
  l2Signer: Wallet
  l1User: Wallet
  l2User: Wallet
  watcher: any
}> {
  const randomWallets = getRandomWallets(3)

  const l1Provider = getL1Provider()
  const l1Admin = getAdminWallet().connect(l1Provider)
  const [l1Deployer, l1User] = connectWallets(randomWallets, l1Provider)

  const l2Provider = getL2Provider()
  const [l2Deployer, l2User] = connectWallets(randomWallets, l2Provider)

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
    l2User,
    l2Signer: l2Deployer,
    watcher,
  }
}
