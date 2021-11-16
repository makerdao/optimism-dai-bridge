import { ethers } from 'ethers'
import { providers } from 'ethers/lib/index'

export function getL1Provider(): providers.BaseProvider {
  const l1 = new ethers.providers.JsonRpcProvider(getL1Url())

  return l1
}

export function getL1Url(): string {
  return 'http://localhost:9545'
}

export function getL2Provider(): providers.BaseProvider {
  const l2 = new ethers.providers.JsonRpcProvider(getL2Url())

  return l2
}

export function getL2Url(): string {
  return 'http://localhost:8545'
}
