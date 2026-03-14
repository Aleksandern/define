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
  AddressModuleT,
} from '../types';
import { isChainActive } from '../utils';

// ERC-20 / ERC-721 share the same Transfer signature
// log.address = token contract
const TRANSFER_TOPIC0 = keccak256(toHex('Transfer(address,address,uint256)'));

// ERC-20 approvals
// log.address = token contract
const APPROVAL_TOPIC0 = keccak256(toHex('Approval(address,address,uint256)'));

// ERC-721 / ERC-1155 operator approval
// log.address = NFT contract)
const TOPIC_APPROVAL_FOR_ALL = keccak256(toHex('ApprovalForAll(address,address,bool)'));

// Aave events
// log.address = Aave Pool contract
const AAVE_SUPPLY_TOPIC0 = keccak256(toHex('Supply(address,address,address,uint256,uint16)'));
const AAVE_WITHDRAW_TOPIC0 = keccak256(toHex('Withdraw(address,address,address,uint256)'));
const AAVE_BORROW_TOPIC0 = keccak256(toHex('Borrow(address,address,address,uint256,uint8,uint256,uint16)'));
const AAVE_REPAY_TOPIC0 = keccak256(toHex('Repay(address,address,address,uint256,bool)'));

export interface AddressScanLogT {
  address: Address,
  topics: Hex[],
  data: Hex,
  blockNumber?: Hex,
  transactionHash?: Hex,
  logIndex?: Hex,
}

export interface AddressScanDataT {
  logsTopic1: AddressScanLogT[],
  logsTopic2: AddressScanLogT[],
  scannedFromBlock: string,
  scannedToBlock: string,
  note?: RpcLogsErrorTypeT,
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
}): Promise<AddressScanLogT[]> {
  const logs = await client.request({
    method: 'eth_getLogs',
    params: [{
      fromBlock: toBlockHex(fromBlock),
      toBlock: toBlockHex(toBlock),
      topics,
    }],
  });

  return logs as AddressScanLogT[];
}

/**
 * Base logs scanner for address.
 *
 * Goal:
 * - do eth_getLogs once per chain stage
 * - reuse raw logs in erc20Activity / tokenDiscovery / protocolDiscovery
 *
 * It scans:
 * - topic1 = user
 * - topic2 = user
 *
 * and several known event signatures at once.
 */
@Injectable()
export class AddressScanModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressScan;

  requires = [ADDRESS_MODULES.chainActivity];

  // private readonly logsLookback = 50_000n; // about 1 week on Ethereum
  private readonly logsLookback = 950_000n; // about 1 week on Ethereum

  constructor(
    private readonly rpcClientFactory: RpcClientFactory,
  ) {}

  async run({
    address,
    chain,
    ctx,
  }: Parameters<AddressModuleT['run']>[0]): Promise<AddressModuleResultT<AddressScanDataT> | null> {
    if (!isChainActive({ ctx })) {
      return null;
    }

    const res: AddressModuleResultT<AddressScanDataT> = {
      key: this.key,
      chain,
      status: 'error',
      data: {
        logsTopic1: [],
        logsTopic2: [],
        scannedFromBlock: '0',
        scannedToBlock: '0',
      },
    };

    try {
      const client = await this.rpcClientFactory.getClient({
        chainIdOrig: chain.chainIdOrig,
      });

      const toBlock = await client.getBlockNumber();
      const fromBlock = toBlock > this.logsLookback
        ? (toBlock - this.logsLookback)
        : 0n;

      const userTopic = topicAddress(address);

      const topic0ForTopic1: Hex[] = [
        // TOKEN DISCOVERY / NFT DISCOVERY
        TRANSFER_TOPIC0,
        APPROVAL_TOPIC0,

        TOPIC_APPROVAL_FOR_ALL,

        // PROTOCOL DISCOVERY
        AAVE_SUPPLY_TOPIC0,
        AAVE_WITHDRAW_TOPIC0,
        AAVE_BORROW_TOPIC0,
        AAVE_REPAY_TOPIC0,
      ];

      const topic0ForTopic2: Hex[] = [
        // TOKEN INCOMING TRANSFERS
        TRANSFER_TOPIC0,
      ];

      const [
        logsTopic1,
        logsTopic2,
      ] = await Promise.all([
        ethGetLogsByTopics({
          client,
          fromBlock,
          toBlock,
          topics: [topic0ForTopic1, userTopic],
        }),
        ethGetLogsByTopics({
          client,
          fromBlock,
          toBlock,
          topics: [topic0ForTopic2, null, userTopic],
        }),
      ]);

      console.log('!!!', { logsTopic1 });
      console.log('!!!', { logsTopic2 });

      res.status = 'ok';
      res.data = {
        logsTopic1,
        logsTopic2,
        scannedFromBlock: fromBlock.toString(),
        scannedToBlock: toBlock.toString(),
      };

      return res;
    } catch (e) {
      const note = classifyRpcLogsError(e);

      if (
        note === 'logs_not_supported'
        || note === 'rate_limited'
        || note === 'range_too_wide'
        || note === 'timeout'
      ) {
        res.status = 'ok';
        res.data = {
          ...(res.data!),
          note,
        };

        return res;
      }

      res.status = 'error';
      res.error = e instanceof Error ? e.message : String(e);

      return res;
    }
  }
}
