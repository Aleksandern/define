import { Injectable } from '@nestjs/common';

import type { Address } from 'viem';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import { ADDRESS_MODULES } from '../constants/address.modules.keys';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModulesRunCtxT,
  AddressModuleT,
} from '../types';

interface ChainActivityDataT {
  txCount: number,
  nativeBalanceWei: string,
  isActive: boolean, // gate flag
  reason: 'txCount>0' | 'balance>0' | 'inactive',
}

@Injectable()
export class AddressChainActivityModule implements AddressModuleT {
  key = ADDRESS_MODULES.chainActivity;

  constructor(private readonly rpcClientFactory: RpcClientFactory) {}

  async run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
    ctx: AddressModulesRunCtxT,
  }): Promise<AddressModuleResultT<ChainActivityDataT> | null> {
    const {
      address, chain,
    } = params;

    const res: AddressModuleResultT<ChainActivityDataT> = {
      key: this.key,
      chain,
      status: 'error',
      data: {
        txCount: 0,
        nativeBalanceWei: '0',
        isActive: false,
        reason: 'inactive',
      },
    };

    try {
      const client = await this.rpcClientFactory.getClient({ chainIdOrig: chain.chainIdOrig });

      // ✅ batch=true is already enabled in RpcClientFactory transport,
      // so viem will automatically combine these 2 calls into a single HTTP request (if the RPC supports batching).
      const [txCount, balanceWei] = await Promise.all([
        client.getTransactionCount({ address }),
        client.getBalance({ address }),
      ]);

      const isActiveByTx = txCount > 0;
      const isActiveByBalance = balanceWei > 0n;
      const isActive = (
        isActiveByTx
        || isActiveByBalance
      );

      let reason: ChainActivityDataT['reason'];

      if (isActiveByTx) {
        reason = 'txCount>0'; // address is active
      } else if (isActiveByBalance) {
        reason = 'balance>0'; // address at least got funds
      } else {
        reason = 'inactive';
      }

      res.status = 'ok';
      res.data = {
        txCount,
        nativeBalanceWei: balanceWei.toString(),
        isActive,
        reason,
      };

      return res;
    } catch (e) {
      res.status = 'error';
      res.error = e instanceof Error ? e.message : String(e);

      return res;
    }
  }
}
