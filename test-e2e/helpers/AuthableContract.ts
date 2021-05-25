import { BaseContract, BigNumber, CallOverrides, ContractTransaction, Overrides } from 'ethers'

import { TypedEvent, TypedEventFilter } from '../../typechain/commons'

export interface AuthableContract extends BaseContract {
  queryFilter<EventArgsArray extends Array<any>, EventArgsObject>(
    event: TypedEventFilter<EventArgsArray, EventArgsObject>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined,
  ): Promise<Array<TypedEvent<EventArgsArray & EventArgsObject>>>
  deny(usr: string, overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>
  rely(usr: string, overrides?: Overrides & { from?: string | Promise<string> }): Promise<ContractTransaction>
  wards(arg0: string, overrides?: CallOverrides): Promise<BigNumber>

  filters: {
    Deny(usr?: string | null): TypedEventFilter<[string], { usr: string }>
    Rely(usr?: string | null): TypedEventFilter<[string], { usr: string }>
  }
}
