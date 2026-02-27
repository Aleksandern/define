import { Injectable } from '@nestjs/common';

import {
  type Address,
  formatUnits,
} from 'viem';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModuleT,
} from '../types';

interface NativeBalanceDataT {
  symbol: string,
  decimals: number,
  balanceWei: string,
  balance: string,
}

@Injectable()
export class AddressNativeBalanceModule implements AddressModuleT {
  readonly key = 'nativeBalance';

  constructor(private readonly rpcClientFactory: RpcClientFactory) {}

  async run({
    address,
    chain,
  }: {
    address: Address,
    chain: AddressModulesChainCtxT,
  }): Promise<AddressModuleResultT<NativeBalanceDataT>> {
    try {
      const client = await this.rpcClientFactory.getClient({
        chainIdOrig: chain.chainIdOrig,
      });

      const wei = await client.getBalance({ address });

      // take symbol/decimals from chainCtx (from DB), if not — fallback
      const symbol = chain.nativeSymbol ?? 'NATIVE';
      const decimals = typeof chain.nativeDecimals === 'number' ? chain.nativeDecimals : 18;

      return {
        key: this.key,
        chainIdOrig: chain.chainIdOrig,
        chainName: chain.name ?? '',
        status: 'ok',
        data: {
          symbol,
          decimals,
          balanceWei: wei.toString(),
          balance: formatUnits(wei, decimals),
        },
      };
    } catch (e) {
      return {
        key: this.key,
        chainIdOrig: chain.chainIdOrig,
        chainName: chain.name ?? '',
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
