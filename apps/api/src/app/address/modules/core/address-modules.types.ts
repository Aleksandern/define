import type { Address } from 'viem';

import { AddressFindOneResultMetaT } from '@define/common/types';

import { AddressModuleKeyT } from './address-modules.keys';

export type AddressModulesChainCtxT = AddressFindOneResultMetaT;

export type AddressModuleStatusT = 'ok' | 'error';

export interface AddressModuleResultT<T = unknown> {
  key: string, // 'nativeBalance' | 'erc20Balances' | 'aaveHf' ...
  chain: AddressModulesChainCtxT,
  data?: T,
  status: AddressModuleStatusT,
  error?: string,
}

export interface AddressModulesRunCtxT {
  // data of modules by key
  data: Record<string, unknown>,
}

export interface AddressModuleT {
  key: AddressModuleKeyT,
  // if the module depends on the results of other modules
  requires?: AddressModuleKeyT[],
  run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
    ctx: AddressModulesRunCtxT,
  }): Promise<AddressModuleResultT | null>,
}
