import { Injectable } from '@nestjs/common';

import type { Address } from 'viem';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import { ADDRESS_MODULES } from '../core/address-modules.keys';
import {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModulesRunCtxT,
  AddressModuleT,
} from '../core/address-modules.types';

export interface AddressChainActivityDataT {
  txCount: number,
  nativeBalanceWei: string,
  isActive: boolean, // gate flag
  reason: 'txCount>0' | 'balance>0' | 'inactive',
}

/**
 * Назначение:
 * Определить, использовался ли адрес вообще в данной сети.
 *
 * Проверки:
 * - eth_getTransactionCount(address)
 * - eth_getBalance(address)
 *
 * Результат:
 * {
 *   isActive: boolean,
 *   txCount: number,
 *   nativeBalanceWei: string
 * }
 *
 * Политика:
 *
 * - chainActivity должен выполняться ПЕРВЫМ модулем для каждой сети.
 * - если isActive === false → дальнейшие модули по этой сети не запускаются.
 *
 * Причина:
 * Если адрес никогда не использовался в сети, нет смысла выполнять:
 * - token discovery
 * - ERC20 balance
 * - protocol discovery
 * - health factor
 *
 * Это экономит большое количество RPC запросов.
 *
 * @see ../docs/module-execution-policy.ts
 */
@Injectable()
export class AddressChainActivityModule implements AddressModuleT {
  key = ADDRESS_MODULES.chainActivity;

  constructor(private readonly rpcClientFactory: RpcClientFactory) {}

  async run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
    ctx: AddressModulesRunCtxT,
  }): Promise<AddressModuleResultT<AddressChainActivityDataT> | null> {
    const {
      address, chain,
    } = params;

    const res: AddressModuleResultT<AddressChainActivityDataT> = {
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

      let reason: AddressChainActivityDataT['reason'];

      if (isActiveByTx) {
        reason = 'txCount>0'; // address is active, has has outgoing transactions
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
