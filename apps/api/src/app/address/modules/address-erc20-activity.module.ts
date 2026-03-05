import { Injectable } from '@nestjs/common';

import type {
  Address,
  Hex,
  PublicClient,
} from 'viem';
import {
  keccak256,
  toHex,
} from 'viem';

import {
  toBlockHex,
  topicAddress,
} from '@define/common/evm';
import {
  classifyRpcLogsError,
  RpcLogsErrorTypeT,
} from '@define/common/rpc';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import { ADDRESS_MODULES } from '../constants/address.modules.keys';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModulesRunCtxT,
  AddressModuleT,
} from '../types';
import { isChainActive } from '../utils';

export interface AddressErc20ActivityDataT {
  hasErc20Activity: boolean,
  transfersIn: number,
  transfersOut: number,
  approvals: number,
  scannedFromBlock: string,
  scannedToBlock: string,
  note?: RpcLogsErrorTypeT,
}

// ERC-20 topics
const TRANSFER_TOPIC0 = keccak256(toHex('Transfer(address,address,uint256)'));
const APPROVAL_TOPIC0 = keccak256(toHex('Approval(address,address,uint256)'));

interface RpcLog {
  address: Address,
  topics: Hex[],
  data: Hex,
  blockNumber?: Hex,
  transactionHash?: Hex,
  logIndex?: Hex,
}

async function ethGetLogsByTopics({
  client,
  fromBlock,
  toBlock,
  topics,
}: {
  client: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  topics: (Hex | Hex[] | null)[],
}): Promise<RpcLog[]> {
  const logs = await client.request({
    method: 'eth_getLogs',
    params: [{
      fromBlock: toBlockHex(fromBlock),
      toBlock: toBlockHex(toBlock),
      topics,
    }],
  });

  return logs as RpcLog[];
}

/**
 * Назначение:
 * Определить, взаимодействовал ли адрес с ERC-20 токенами
 * (что является сильным сигналом DeFi активности).
 *
 * Проверки:
 * - eth_getLogs Transfer(address,address,uint256)
 * - eth_getLogs Approval(address,address,uint256)
 *
 * Обычно сканируется последние N блоков (например 20k).
 *
 * Результат:
 * {
 *   hasErc20Activity: boolean,
 *   transfersIn: number,
 *   transfersOut: number,
 *   approvals: number
 * }
 *
 * Важное отличие от chainActivity:
 *
 * erc20Activity НЕ является строгим gate-модулем.
 *
 * Причины:
 * - eth_getLogs часто ограничен RPC провайдерами
 * - activity могла быть вне lookback диапазона
 * - некоторые RPC полностью блокируют logs
 *
 * Поэтому ошибки eth_getLogs должны переводиться в:
 *
 * status: "ok"
 * data.note: "logs_not_supported" | "rate_limited" | ...
 *
 * @see ../docs/module-execution-policy.ts
 */
@Injectable()
export class AddressErc20ActivityModule implements AddressModuleT {
  key = ADDRESS_MODULES.erc20Activity;

  requires = [ADDRESS_MODULES.chainActivity];

  // Сколько блоков назад смотреть (подбери). Для Ethereum 20k ~= ~3 суток.
  private readonly logsLookback = 20_000n;

  constructor(private readonly rpcClientFactory: RpcClientFactory) {}

  async run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
    ctx: AddressModulesRunCtxT,
  }): Promise<AddressModuleResultT<AddressErc20ActivityDataT> | null> {
    const {
      address, chain, ctx,
    } = params;

    // gate: if the chain is not active - do not spend eth_getLogs
    const isChainActiveRes = isChainActive({ ctx });
    if (!isChainActiveRes) {
      return null;
    }

    const res: AddressModuleResultT<AddressErc20ActivityDataT> = {
      key: this.key,
      chain,
      status: 'error',
      data: {
        hasErc20Activity: false,
        transfersIn: 0,
        transfersOut: 0,
        approvals: 0,
        scannedFromBlock: '0',
        scannedToBlock: '0',
      },
    };

    try {
      const client = await this.rpcClientFactory.getClient({ chainIdOrig: chain.chainIdOrig });

      const toBlock = await client.getBlockNumber();
      const fromBlock = toBlock > this.logsLookback ? (toBlock - this.logsLookback) : 0n;

      const addrTopic = topicAddress(address);

      // Transfer OUT: topic1 = from
      // Transfer IN:  topic2 = to
      // Approval:     topic1 = owner
      const [transfersOut, transfersIn, approvals] = await Promise.all([
        ethGetLogsByTopics({
          client,
          fromBlock,
          toBlock,
          topics: [TRANSFER_TOPIC0, addrTopic],
        }),
        ethGetLogsByTopics({
          client,
          fromBlock,
          toBlock,
          topics: [TRANSFER_TOPIC0, null, addrTopic],
        }),
        ethGetLogsByTopics({
          client,
          fromBlock,
          toBlock,
          topics: [APPROVAL_TOPIC0, addrTopic],
        }),
      ]);

      const transfersOutCount = transfersOut.length;
      const transfersInCount = transfersIn.length;
      const approvalsCount = approvals.length;

      res.status = 'ok';
      res.data = {
        hasErc20Activity: (transfersOutCount + transfersInCount + approvalsCount) > 0,
        transfersIn: transfersInCount,
        transfersOut: transfersOutCount,
        approvals: approvalsCount,
        scannedFromBlock: fromBlock.toString(),
        scannedToBlock: toBlock.toString(),
      };

      return res;
    } catch (e) {
      const note = classifyRpcLogsError(e);

      if (note) {
        res.status = 'ok';
        (res.data as Required<AddressErc20ActivityDataT>).note = note; // <= this is what frontend can show as a gray text

        return res;
      }

      res.status = 'error';
      res.error = e instanceof Error ? e.message : String(e);

      return res;
    }
  }
}
