import { providers, Wallet } from 'ethers'

export function getRandomWallets(n: number): Wallet[] {
  const wallets = [...Array(n)]

  return wallets.map(() => Wallet.createRandom())
}

export function getAdminWallet(): Wallet {
  return new Wallet('0xea8b000efb33c49d819e8d6452f681eed55cdf7de47d655887fc0e318906f2e7')
}

export function connectWallets(wallets: Wallet[], provider: providers.BaseProvider): Wallet[] {
  return wallets.map((w) => w.connect(provider))
}
