import { ethers } from 'hardhat'
export const makeHexString = (byte: string, len: number): string => {
  return '0x' + byte.repeat(len)
}

export const makeAddress = (byte: string): string => {
  return makeHexString(byte, 20)
}

export const MAX_UINT256 = ethers.BigNumber.from(2).pow(256).sub(1)
export const ZERO_ADDRESS = makeAddress('00')
export const NON_ZERO_ADDRESS = makeAddress('11')

export function q18(n: number) {
  return ethers.BigNumber.from(10).pow(18).mul(n).toString()
}
