import { ethers } from 'ethers'
import { providers, Wallet } from 'ethers/lib/index'

export function getL1Signers(provider: providers.BaseProvider): Wallet[] {
  const pkeys = [
    '0xea8b000efb33c49d819e8d6452f681eed55cdf7de47d655887fc0e318906f2e7', // setup by hardhat
    '21dabca961aa747b1e98d5133831484c2f17c5e7304a7c84637afb5078482880', // empty random account: 0x00ABEf446F4fB600EEA2811386242d3D005B8169
  ]

  const connectedWallets = pkeys.map((pkey) => {
    return new ethers.Wallet(pkey, provider)
  })

  return connectedWallets
}

export function getL1Provider(): providers.BaseProvider {
  const l1 = new ethers.providers.JsonRpcProvider('http://localhost:9545')

  return l1
}
