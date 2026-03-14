import { Injectable } from '@nestjs/common';

import type {
  Address,
  Hex,
} from 'viem';
import {
  keccak256,
  toHex,
} from 'viem';

import type {
  RpcLogsErrorTypeT,
} from '@define/common/rpc';

import { ADDRESS_MODULES } from '../constants/address.modules.keys';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModulesRunCtxT,
  AddressModuleT,
} from '../types';

import type {
  AddressScanDataT,
  AddressScanLogT,
} from './address-scan.module';

const TRANSFER_TOPIC0 = keccak256(toHex('Transfer(address,address,uint256)'));
const APPROVAL_TOPIC0 = keccak256(toHex('Approval(address,address,uint256)'));
const APPROVAL_FOR_ALL_TOPIC0 = keccak256(toHex('ApprovalForAll(address,address,bool)'));

export interface AddressTokenDiscoveryDataT {
  hasTokenActivity: boolean,
  transfersIn: number,
  transfersOut: number,
  approvals: number,
  approvalForAll: number,

  tokenCandidates: Address[],

  scannedFromBlock: string,
  scannedToBlock: string,
  note?: RpcLogsErrorTypeT,
}

function topicEq(topic: Hex | undefined, expected: Hex): boolean {
  return (
    (typeof topic === 'string')
    && (topic.toLowerCase() === expected.toLowerCase())
  );
}

function isTransferLog(log: AddressScanLogT): boolean {
  return topicEq(log.topics[0], TRANSFER_TOPIC0);
}

function isApprovalLog(log: AddressScanLogT): boolean {
  return topicEq(log.topics[0], APPROVAL_TOPIC0);
}

function isApprovalForAllLog(log: AddressScanLogT): boolean {
  return topicEq(log.topics[0], APPROVAL_FOR_ALL_TOPIC0);
}

/**
 * Derives token candidates from AddressScan raw logs.
 *
 * Important:
 * - does NOT do RPC calls
 * - uses log.address as token / NFT contract candidate
 * - can be used as a gate for erc20Balances / nft modules
 */
@Injectable()
export class AddressTokenDiscoveryModule implements AddressModuleT {
  key = ADDRESS_MODULES.tokenDiscovery;

  requires = [ADDRESS_MODULES.addressScan];

  async run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
    ctx: AddressModulesRunCtxT,
  }): Promise<AddressModuleResultT<AddressTokenDiscoveryDataT> | null> {
    const {
      chain,
      ctx,
    } = params;

    const scan = ctx.data[ADDRESS_MODULES.addressScan] as AddressScanDataT | undefined;

    if (!scan) {
      return null;
    }

    const res: AddressModuleResultT<AddressTokenDiscoveryDataT> = {
      key: this.key,
      chain,
      status: 'ok',
      data: {
        hasTokenActivity: false,
        transfersIn: 0,
        transfersOut: 0,
        approvals: 0,
        approvalForAll: 0,
        tokenCandidates: [],
        scannedFromBlock: scan.scannedFromBlock,
        scannedToBlock: scan.scannedToBlock,
        ...(scan.note ? { note: scan.note } : {}),
      },
    };

    const tokenSet = new Set<string>();

    // logsTopic1:
    // - Transfer OUT  => topic1 = user
    // - Approval      => topic1 = owner
    // - ApprovalForAll=> topic1 = owner
    scan.logsTopic1.forEach((log) => {
      if (isTransferLog(log)) {
        res.data!.transfersOut += 1;
        tokenSet.add(log.address.toLowerCase());

        return;
      }

      if (isApprovalLog(log)) {
        res.data!.approvals += 1;
        tokenSet.add(log.address.toLowerCase());

        return;
      }

      if (isApprovalForAllLog(log)) {
        res.data!.approvalForAll += 1;
        tokenSet.add(log.address.toLowerCase());
      }
    });

    // logsTopic2:
    // - Transfer IN => topic2 = user
    scan.logsTopic2.forEach((log) => {
      if (isTransferLog(log)) {
        res.data!.transfersIn += 1;
        tokenSet.add(log.address.toLowerCase());
      }
    });

    res.data!.tokenCandidates = Array.from(tokenSet) as Address[];
    res.data!.hasTokenActivity = res.data!.tokenCandidates.length > 0;

    return res;
  }
}
