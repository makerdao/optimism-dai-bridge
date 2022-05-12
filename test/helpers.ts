import { getContractDefinition } from '@eth-optimism/contracts'
import { smockit } from '@eth-optimism/smock'
import { ContractFactory, Wallet } from 'ethers'
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

export async function deployAbstractMock<T extends ContractFactory>(
  name: string,
  opts: {
    provider?: any
    address?: string
  } = {},
): Promise<ReturnType<T['deploy']> & { smocked: any }> {
  opts.address = opts.address || Wallet.createRandom().address
  const contract = (await ethers.getContractAt(name, opts.address)) as any
  return await smockit(contract, opts)
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

export function addressToBytes32(addr: string): string {
  return ethers.utils.hexlify(ethers.utils.zeroPad(addr, 32))
}
