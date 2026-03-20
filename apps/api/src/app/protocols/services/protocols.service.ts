import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type {
  AggregatePaginateModel,
  PipelineStage,
  Types,
} from 'mongoose';

import type {
  ProtocolCreateSrvT,
  ProtocolSrvT,
} from '@define/common/types';

import { ProtocolsAggregate } from '../aggrs';
import {
  Protocol,
  ProtocolDocument,
} from '../schemas';

@Injectable()
export class ProtocolsService {
  constructor(
    @InjectModel(Protocol.name)
    private readonly protocolModel: AggregatePaginateModel<ProtocolDocument>,
  ) {}

  async upsertOne({
    item,
  }: {
    item: ProtocolCreateSrvT,
  }): Promise<{
    _id: Types.ObjectId,
    key: string,
  }> {
    const doc = await this.protocolModel.findOneAndUpdate<ProtocolDocument>(
      {
        key: item.key.toLowerCase(),
      },
      {
        $set: {
          key: item.key.toLowerCase(),
          slug: item.slug,
          name: item.name,
          family: item.family?.toLowerCase(),
          website: item.website,
          source: item.source,
          source_ref: item.source_ref,
          isDisabled: item.isDisabled ?? false,
        },
      },
      {
        returnDocument: 'after',
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return {
      _id: doc._id,
      key: doc.key,
    };
  }

  async findBy({
    keys,
  }: {
    keys: string[],
  }): Promise<ProtocolSrvT[]> {
    if (keys.length === 0) {
      return [];
    }

    const protocolsAggregate = new ProtocolsAggregate();
    const matchAnd: PipelineStage.Match['$match'][] = [
      {
        key: {
          $in: keys.map((v) => v.toLowerCase()),
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
      ...protocolsAggregate.relations(),
    ];

    const res = await this.protocolModel.aggregate<ProtocolSrvT>(aggregate).exec();

    return res;
  }
}
