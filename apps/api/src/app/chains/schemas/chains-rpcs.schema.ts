import {
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';

import {
  Document,
  Types,
} from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';

import {
  ChainsRpcDisableReasonP,
  ChainsRpcSchemaT,
} from '@define/common/types';

import { SchemaTimestampsConfig } from '@appApi/types';

import { Chain } from './chains.schema';

export type ChainsRpcDocument = ChainsRpc & Document<Types.ObjectId> & SchemaTimestampsConfig;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class ChainsRpc implements ChainsRpcSchemaT {
  @Prop({
    required: true,
    ref: Chain.name,
    type: Types.ObjectId,
  })
  chainId: ChainsRpcSchemaT['chainId'];

  @Prop({
    required: true,
    type: String,
  })
  url: ChainsRpcSchemaT['url'];

  @Prop({
    type: Boolean,
  })
  isPrimary: ChainsRpcSchemaT['isPrimary'];

  @Prop({
    required: false,
    type: Date,
  })
  cooldownUntil: ChainsRpcSchemaT['cooldownUntil'];

  @Prop({
    required: false,
    type: Number,
  })
  latencyMs: ChainsRpcSchemaT['latencyMs'];

  @Prop({
    required: false,
    type: Date,
  })
  lastCheckedAt: ChainsRpcSchemaT['lastCheckedAt'];

  @Prop({
    required: false,
    type: String,
  })
  lastError: ChainsRpcSchemaT['lastError'];

  @Prop({
    required: false,
    type: Boolean,
  })
  isHealthy: ChainsRpcSchemaT['isHealthy'];

  @Prop({
    required: false,
    type: Number,
  })
  failCount: ChainsRpcSchemaT['failCount'];

  @Prop({
    required: false,
    type: Boolean,
  })
  isDisabled: ChainsRpcSchemaT['isDisabled'];

  @Prop({
    required: false,
    type: String,
    enum: ChainsRpcDisableReasonP,
  })
  disabledReason: ChainsRpcSchemaT['disabledReason'];
}

const schema = SchemaFactory.createForClass(ChainsRpc);

schema.plugin(aggregatePaginate);

export const ChainsRpcSchema = schema;
