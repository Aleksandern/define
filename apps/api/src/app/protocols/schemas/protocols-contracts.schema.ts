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
  ProtocolsContractSchemaT,
  ProtocolSourceP,
} from '@define/common/types';

import { SchemaTimestampsConfig } from '@appApi/types';

import { Chain } from '@appApi/app/chains/schemas';

import { Protocol } from './protocols.schema';

export type ProtocolsContractDocument = ProtocolsContract & Document<Types.ObjectId> & SchemaTimestampsConfig;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class ProtocolsContract implements ProtocolsContractSchemaT {
  @Prop({
    required: true,
    ref: Protocol.name,
    type: Types.ObjectId,
  })
  protocolId: ProtocolsContractSchemaT['protocolId'];

  @Prop({
    type: String,
    required: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  protocolKey: ProtocolsContractSchemaT['protocolKey'];

  @Prop({
    type: Types.ObjectId,
    ref: Chain.name,
    required: true,
    index: true,
  })
  chainId: ProtocolsContractSchemaT['chainId'];

  @Prop({
    type: Number,
    required: true,
    index: true,
  })
  chainIdOrig: ProtocolsContractSchemaT['chainIdOrig'];

  @Prop({
    type: String,
    required: true,
    index: true,
    trim: true,
    lowercase: true,
  })
  address: ProtocolsContractSchemaT['address'];

  @Prop({
    type: String,
    required: false,
    index: true,
    trim: true,
    lowercase: true,
  })
  role: ProtocolsContractSchemaT['role'];

  @Prop({
    type: Boolean,
    required: false,
    default: false,
  })
  isProxy: ProtocolsContractSchemaT['isProxy'];

  @Prop({
    type: String,
    required: false,
    trim: true,
    lowercase: true,
  })
  implementationAddress: ProtocolsContractSchemaT['implementationAddress'];

  @Prop({
    type: String,
    required: true,
    enum: ProtocolSourceP,
    index: true,
  })
  source: ProtocolsContractSchemaT['source'];

  @Prop({
    type: String,
    required: false,
  })
  sourceRef: ProtocolsContractSchemaT['sourceRef'];

  @Prop({
    type: Number,
    required: true,
    default: 100,
  })
  confidence: ProtocolsContractSchemaT['confidence'];

  @Prop({
    type: Date,
    required: false,
  })
  firstSeenAt: ProtocolsContractSchemaT['firstSeenAt'];

  @Prop({
    type: Date,
    required: false,
  })
  lastConfirmedAt: ProtocolsContractSchemaT['lastConfirmedAt'];
}

const schema = SchemaFactory.createForClass(ProtocolsContract);

schema.index(
  {
    protocolId: 1,
    chainIdOrig: 1,
    address: 1,
  },
  { unique: true },
);

schema.plugin(aggregatePaginate);

export const ProtocolsContractSchema = schema;
