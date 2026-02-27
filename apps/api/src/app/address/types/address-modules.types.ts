import type { Address } from 'viem';

export interface AddressModulesChainCtxT {
  chainIdOrig: number,
  chainIdDb: string, // _id chain in DB
  name?: string,
  nativeSymbol?: string, //  convinent for UI
  nativeDecimals?: number,
}

export type AddressModuleStatusT = 'ok' | 'error';

export interface AddressModuleResultT<T = any> {
  key: string, // 'nativeBalance' | 'erc20Balances' | 'aaveHf' ...
  chainIdOrig: number,
  chainName: string,
  status: AddressModuleStatusT,
  data?: T,
  error?: string,
}

export interface AddressModuleT {
  key: string,
  run(params: { address: Address; chain: AddressModulesChainCtxT }): Promise<AddressModuleResultT | null>,
}
