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
    query,
  }: {
    query: {
      chainIdOrig?: number,
      address?: Address[],
    },
  }): Promise<ProtocolsContractSrvT[]> {
    const {
      chainIdOrig,
      address,
    } = query;

    const protocolsContractsAggregate = new ProtocolsContractsAggregate();
    const matchAnd: PipelineStage.Match['$match'][] = [];

    if (chainIdOrig) {
      matchAnd.push({
        chainIdOrig,
      });
    }

    if (
      address
      && (address.length > 0)
    ) {
      const normalizedAddress = [...new Set(
        address.map((contract) => contract.toLowerCase()),
      )];

      matchAnd.push({
        address: {
          $in: normalizedAddress,
        },
      });
    }

    matchAnd.push({
      isDisabled: { $ne: true },
    });

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
