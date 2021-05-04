import { providers, Wallet } from 'ethers'

export function getRandomWallets(n: number): Wallet[] {
  const wallets = [...Array(n)]

  return wallets.map(() => Wallet.createRandom())
}

export function getAdminWallet(): Wallet {
  return new Wallet('0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e')
}

export function connectWallets(wallets: Wallet[], provider: providers.BaseProvider): Wallet[] {
  return wallets.map((w) => w.connect(provider))
}
