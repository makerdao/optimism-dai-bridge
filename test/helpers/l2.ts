import { JsonRpcProvider } from '@ethersproject/providers'
import { ethers } from 'ethers'
import { providers, Wallet } from 'ethers/lib/index'

export function getL2Signers(provider: providers.BaseProvider): Wallet[] {
  const pkeys = [
    '21dabca961aa747b1e98d5133831484c2f17c5e7304a7c84637afb5078482880', // empty random account: 0x00ABEf446F4fB600EEA2811386242d3D005B8169
  ]

  const connectedWallets = pkeys.map((pkey) => {
    return new ethers.Wallet(pkey, provider)
  })

  return connectedWallets
}

export function getL2Provider(): providers.BaseProvider {
  const l2 = new JsonRpcProvider('http://localhost:8545')

  return l2
}
