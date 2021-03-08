import { ethers } from 'ethers'
import { providers } from 'ethers/lib/index'

export function getL1Provider(): providers.BaseProvider {
  const l1 = new ethers.providers.JsonRpcProvider('http://localhost:9545')

  return l1
}
