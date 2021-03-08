import { JsonRpcProvider } from '@ethersproject/providers'
import { providers } from 'ethers/lib/index'

export function getL2Provider(): providers.BaseProvider {
  const l2 = new JsonRpcProvider('http://localhost:8545')

  return l2
}
