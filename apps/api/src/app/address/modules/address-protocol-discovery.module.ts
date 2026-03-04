import { Injectable } from '@nestjs/common';

import {
  type Address,
  keccak256,
  pad,
  toBytes,
} from 'viem';

import { getAaveV3MarketsByChainId } from '@appApi/chains/aave';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import { ADDRESS_MODULES } from '../constants';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModuleT,
} from '../types';

interface DiscoveryData {
  aave?: {
    usedMarkets: {
      marketKey: string,
      pool: string,
    }[],
  },
}

const topic0 = (sig: string) => keccak256(toBytes(sig));

// Aave v3/origin pool events (user indexed)
const AAVE_TOPICS0 = [
  topic0('Supply(address,address,address,uint256,uint16)'),
  topic0('Borrow(address,address,address,uint256,uint256,uint256,uint16)'),
  topic0('Repay(address,address,address,uint256,bool)'),
  topic0('Withdraw(address,address,address,uint256)'),
];

@Injectable()
export class AddressProtocolDiscoveryModule implements AddressModuleT {
  key = ADDRESS_MODULES.protocolDiscovery;

  // сколько блоков назад смотрим (MVP)
  // позже заменишь на lastDiscoveryBlock in DB
  private readonly lookbackBlocks = 200_000n;

  constructor(
    private readonly rpcClientFactory: RpcClientFactory,
  ) {}

  async run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
  }): Promise<AddressModuleResultT<DiscoveryData> | null> {
    const {
      address, chain,
    } = params;

    const res: AddressModuleResultT<DiscoveryData> = {
      key: this.key,
      chain,
      status: 'error',
      data: {},
    };

    try {
      const client = await this.rpcClientFactory.getClient({ chainIdOrig: chain.chainIdOrig });

      // latest block
      const latest = await client.getBlockNumber();
      const fromBlock = latest > this.lookbackBlocks ? (latest - this.lookbackBlocks) : 0n;

      // user topic = 32-bytes padded address
      const userTopic = pad(address, { size: 32 });

      console.log('!!!', { userTopic });

      // --- Aave discovery ---
      const markets = getAaveV3MarketsByChainId({ chainIdOrig: chain.chainIdOrig });
      // if (markets.length === 0) {
      //   // на этой сети Aave нет — не ошибка
      //   res.status = 'ok';
      //   res.data = { aave: { usedMarkets: [] } };

      //   return res;
      // }

      // // Проверяем каждый pool адрес: есть ли события с user в окне блоков
      // const usedMarkets: { marketKey: string; pool: string }[] = [];

      // // Можно оптимизировать batch'ем, но MVP норм
      // // eslint-disable-next-line no-restricted-syntax
      // for (const m of markets) {
      //   const logs = await client.getLogs({
      //     address: m.pool as Address,
      //     fromBlock,
      //     toBlock: latest,
      //     // OR по topic0: topics[0] = [a,b,c], topics[1] = user
      //     topics: [AAVE_TOPICS0 as any, userTopic],
      //   });

      //   if (logs.length > 0) {
      //     usedMarkets.push({
      //       marketKey: m.key,
      //       pool: m.pool,
      //     });
      //   }
      // }

      // res.status = 'ok';
      // res.data = { aave: { usedMarkets } };

      return res;
    } catch (e) {
      res.status = 'error';
      res.error = e instanceof Error ? e.message : String(e);

      return res;
    }
  }
}
