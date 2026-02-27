import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type {
  AggregatePaginateModel,
  PipelineStage,
  Types,
} from 'mongoose';

import {
  XOR,
} from '@define/common/types';
import {
  dateTimeUtils,
  tk,
} from '@define/common/utils';

import {
  dbUtils,
  httpExceptionBadRequest,
} from '@appApi/utils';

import { ChainsRpcsAggregate } from '../aggrs';
import {
  ChainsRpc,
  ChainsRpcDocument,
} from '../schemas';

@Injectable()
export class ChainsRpcsService {
  constructor(
    @InjectModel(ChainsRpc.name) private chainsRpcModel: AggregatePaginateModel<ChainsRpcDocument>,
  ) {}

  async getBestRpcs({
    chainId,
    chainIdOrig,
    limit = 3,
  }: {
    limit?: number,
  } & XOR<{
    chainId: string | Types.ObjectId,
  }, {
    chainIdOrig: number,
  }>) {
    const now = dateTimeUtils.getLib().toDate();

    const chainsRpcsAggregate = new ChainsRpcsAggregate();

    const matchAndRcp: PipelineStage.Match['$match'][] = [
      {
        isDisabled: { $ne: true },
      },
      {
        $or: [
          { cooldownUntil: { $exists: false } },
          { cooldownUntil: { $lte: now } },
        ],
      },
    ];
    const matchAndChain: PipelineStage.Match['$match'][] = [];

    if (chainId) {
      matchAndChain.push({ 'chain._id': dbUtils.idToObjectId(chainId) });
    } else if (!tk.isNil(chainIdOrig)) {
      matchAndChain.push({ 'chain.chainIdOrig': chainIdOrig });
    } else {
      httpExceptionBadRequest('Either chainId or chainIdOrig must be provided');
    }

    const aggregate: PipelineStage[] = [
      {
        $match: {
          $and: matchAndRcp,
        },
      },
      ...chainsRpcsAggregate.relations(),
      {
        $match: {
          $and: matchAndChain,
        },
      },
      {
        $sort: {
          isHealthy: -1, // healthy first
          isPrimary: -1, // primary first
          latencyMs: 1, // lower latency is better
          failCount: 1, // lower fail count is better
        },
      },
      {
        $limit: limit,
      },
    ];

    const res = await this.chainsRpcModel.aggregate<ChainsRpcDocument>(aggregate).exec();

    return res;
  }
}
