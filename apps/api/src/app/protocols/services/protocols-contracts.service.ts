import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type {
  AggregatePaginateModel,
  AnyBulkWriteOperation,
  PipelineStage,
} from 'mongoose';
import type {
  Address,
} from 'viem';

import type {
  OmitStrict,
  ProtocolsContractCreateSrvT,
  ProtocolsContractSrvT,
} from '@define/common/types';

import { ProtocolsContractsAggregate } from '../aggrs';
import {
  ProtocolsContract,
  ProtocolsContractDocument,
} from '../schemas';

@Injectable()
export class ProtocolsContractsService {
  constructor(
    @InjectModel(ProtocolsContract.name)
    private readonly protocolsContractModel: AggregatePaginateModel<ProtocolsContractDocument>,
  ) {}

  async bulkUpsert(params: {
    items: OmitStrict<ProtocolsContractCreateSrvT, 'firstSeenAt' | 'lastConfirmedAt'>[],
  }): Promise<void> {
    const {
      items,
    } = params;

    if (items.length === 0) {
      return;
    }

    const now = new Date();

    const ops: AnyBulkWriteOperation<ProtocolsContractDocument>[] = items.map((item) => ({
      updateOne: {
        filter: {
          protocolId: item.protocolId,
          chainIdOrig: item.chainIdOrig,
          address: item.address.toLowerCase(),
        },
        update: {
          $set: {
            protocolId: item.protocolId,
            protocolKey: item.protocolKey.toLowerCase(),
            chainIdOrig: item.chainIdOrig,
            chainId: item.chainId,
            address: item.address.toLowerCase(),
            role: item.role?.toLowerCase(),
            isProxy: item.isProxy ?? false,
            implementationAddress: item.implementationAddress?.toLowerCase(),
            source: item.source,
            sourceRef: item.sourceRef,
            confidence: item.confidence ?? 100,
            lastConfirmedAt: now,
          },
          $setOnInsert: {
            firstSeenAt: now,
          },
        },
        upsert: true,
      },
    }));

    await this.protocolsContractModel.bulkWrite(ops, {
      ordered: false,
    });
  }

  async findBy({
    chainIdOrig,
    contracts,
  }: {
    chainIdOrig: number,
    contracts: Address[],
  }): Promise<ProtocolsContractSrvT[]> {
    if (contracts.length === 0) {
      return [];
    }

    const protocolsContractsAggregate = new ProtocolsContractsAggregate();
    const matchAnd: PipelineStage.Match['$match'][] = [
      {
        chainIdOrig,
      },
      {
        address: {
          $in: contracts.map((v) => v.toLowerCase()),
        },
      },
      {
        isDisabled: { $ne: true },
      },
    ];

    const aggregate: PipelineStage[] = [
      {
        $match: {
          $and: matchAnd,
        },
      },
      ...protocolsContractsAggregate.relations(),
    ];

    const res = await this.protocolsContractModel.aggregate<ProtocolsContractSrvT>(aggregate).exec();

    return res;
  }
}
