export const makeHexString = (byte: string, len: number): string => {
  return '0x' + byte.repeat(len)
}

export const makeAddress = (byte: string): string => {
  return makeHexString(byte, 20)
}

export const ZERO_ADDRESS = makeAddress('00')
export const NON_ZERO_ADDRESS = makeAddress('11')
