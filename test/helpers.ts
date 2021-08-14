import { getContractDefinition } from '@eth-optimism/contracts'
import { smockit } from '@eth-optimism/smock'
import { ContractFactory } from 'ethers'
import { ethers } from 'hardhat'

export async function deployMock<T extends ContractFactory>(
  name: string,
  opts: {
    provider?: any
    address?: string
  } = {},
): Promise<ReturnType<T['deploy']> & { smocked: any }> {
  const factory = (await ethers.getContractFactory(name)) as any
  return await smockit(factory, opts)
}

export async function deployOptimismContractMock<T extends ContractFactory>(
  name: string,
  opts: {
    provider?: any
    address?: string
  } = {},
): Promise<ReturnType<T['deploy']> & { smocked: any }> {
  const artifact = getContractDefinition(name)
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode) as any
  return await smockit(factory, opts)
}
