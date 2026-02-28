import type { Address } from 'viem';

import { AddressFindOneResultMetaT } from '@define/common/types';

export type AddressModulesChainCtxT = AddressFindOneResultMetaT;

export type AddressModuleStatusT = 'ok' | 'error';

export interface AddressModuleResultT<T = unknown> {
  key: string, // 'nativeBalance' | 'erc20Balances' | 'aaveHf' ...
  chain: AddressModulesChainCtxT,
  data?: T,
  status: AddressModuleStatusT,
  error?: string,
}

export interface AddressModuleT {
  key: string,
  run(params: { address: Address; chain: AddressModulesChainCtxT }): Promise<AddressModuleResultT | null>,
}
