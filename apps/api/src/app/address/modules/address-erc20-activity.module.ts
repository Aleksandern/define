import { Injectable } from '@nestjs/common';

import type {
  Address,
  Hex,
  PublicClient,
} from 'viem';
import {
  encodePacked,
  keccak256,
  toHex,
} from 'viem';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import { ADDRESS_MODULES } from '../constants/address.modules.keys';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModulesRunCtxT,
  AddressModuleT,
} from '../types';

type Erc20ActivityNoteT = (
  | 'logs_not_supported'
  | 'rate_limited'
  | 'logs_too_heavy'
  | 'logs_requires_address'
  | 'network_error'
);

export interface Erc20ActivityDataT {
  hasErc20Activity: boolean,
  transfersIn: number,
  transfersOut: number,
  approvals: number,
  scannedFromBlock: string,
  scannedToBlock: string,
  note?: Erc20ActivityNoteT,
}

// ERC-20 topics
const TRANSFER_TOPIC0 = keccak256(toHex('Transfer(address,address,uint256)'));
const APPROVAL_TOPIC0 = keccak256(toHex('Approval(address,address,uint256)'));

function topicAddress(addr: Address): Hex {
  // topic = 32-byte left-padded address
  const packed = encodePacked(['address'], [addr]); // 20 bytes hex

  return (`0x${packed.slice(2).padStart(64, '0')}`);
}

function toBlockHex(b: bigint): Hex {
  return (`0x${b.toString(16)}`);
}

function normalizeMsg(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).toLowerCase();
}

function classifyLogsError(e: unknown): Erc20ActivityNoteT | undefined {
  const msg = normalizeMsg(e);

  // A) not supported / blocked
  if (
    msg.includes('eth_getlogs') && (
      msg.includes('does not exist')
      || msg.includes('not available')
      || msg.includes('not whitelisted')
      || msg.includes('method not found')
      || msg.includes('unsupported')
    )
  ) {
    return 'logs_not_supported';
  }

  // B) rate limited
  if (
    msg.includes('429')
    || msg.includes('rate limit')
    || msg.includes('too many requests')
    || msg.includes('throttle')
    || msg.includes('request rate exceeded')
  ) {
    return 'rate_limited';
  }

  // C) too heavy / too many results / too wide
  if (
    msg.includes('too many results')
    || (
      msg.includes('more than')
      && msg.includes('results')
    )
    || msg.includes('response size')
    || msg.includes('range is too wide')
    || msg.includes('log response size')
    || msg.includes('query returned more than')
  ) {
    return 'logs_too_heavy';
  }

  // D) requires address
  if (
    msg.includes('must specify address')
    || msg.includes('address required')
  ) {
    return 'logs_requires_address';
  }

  // E) network-ish
  if (
    msg.includes('timeout')
    || msg.includes('fetch failed')
    || msg.includes('econnreset')
    || msg.includes('econnrefused')
    || msg.includes('enotfound')
    || msg.includes('etimedout')
  ) {
    return 'network_error';
  }

  return undefined;
}

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
  }): Promise<AddressModuleResultT<Erc20ActivityDataT> | null> {
    const {
      address, chain, ctx,
    } = params;

    // gate: if the chain is not active - do not spend eth_getLogs
    const act = ctx.data[ADDRESS_MODULES.chainActivity] as { isActive?: boolean } | undefined;
    if (act?.isActive === false) {
      return null;
    }

    const res: AddressModuleResultT<Erc20ActivityDataT> = {
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
      const note = classifyLogsError(e);

      if (note) {
        res.status = 'ok';
        (res.data as Required<Erc20ActivityDataT>).note = note; // <= this is what frontend can show as a gray text

        return res;
      }

      res.status = 'error';
      res.error = e instanceof Error ? e.message : String(e);

      return res;
    }
  }
}
