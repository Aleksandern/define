import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type {
  AggregatePaginateModel,
  PipelineStage,
} from 'mongoose';

import { ChainSrvT } from '@define/common/types';

import { ChainsAggregate } from '../aggrs';
import {
  Chain,
  ChainDocument,
} from '../schemas';

@Injectable()
export class ChainsService {
  constructor(
    @InjectModel(Chain.name) private chainModel: AggregatePaginateModel<ChainDocument>,
  ) {}

  async getEnabledChains({
    limit,
    chainIdsOrig,
  }: {
    limit?: number,
    chainIdsOrig?: number[],
  } = {}): Promise<ChainSrvT[]> {
    const chainsAggregate = new ChainsAggregate();

    const matchAnd: PipelineStage.Match['$match'][] = [
      {
        isDisabled: { $ne: true },
      },
    ];

    if (
      chainIdsOrig
      && (chainIdsOrig.length > 0)
    ) {
      matchAnd.push({
        chainIdOrig: { $in: chainIdsOrig },
      });
    }

    const aggregate: PipelineStage[] = [
      {
        $match: {
          $and: matchAnd,
        },
      },
      ...chainsAggregate.relations(),
    ];

    const matchAfterAnd: PipelineStage.Match['$match'][] = [];

    if (limit !== undefined) {
      matchAfterAnd.push({
        chainIdOrig: { $lte: limit },
      });
    }

    if (matchAfterAnd.length > 0) {
      aggregate.push({
        $match: {
          $and: matchAfterAnd,
        },
      });
    }

    const res = await this.chainModel.aggregate<ChainSrvT>(aggregate).exec();

    return res;
  }

  async getEnabledChain({
    chainIdOrig,
  }: {
    chainIdOrig: number,
  }): Promise<ChainSrvT | undefined> {
    const chainsAggregate = new ChainsAggregate();

    const matchAnd: PipelineStage.Match['$match'][] = [
      {
        chainIdOrig,
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
      ...chainsAggregate.relations(),
      {
        $limit: 2,
      },
    ];

    const resDb = await this.chainModel.aggregate<ChainSrvT>(aggregate).exec();

    if (resDb.length > 1) {
      throw new Error('Multiple chains found with same chainIdOrig');
    }

    const res = resDb?.[0];

    return res;
  }
}
