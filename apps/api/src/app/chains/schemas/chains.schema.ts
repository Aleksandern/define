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
  ChainSchemaT,
} from '@define/common/types';

import { SchemaTimestampsConfig } from '@appApi/types';

export type ChainDocument = Chain & Document<Types.ObjectId> & SchemaTimestampsConfig;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class Chain implements ChainSchemaT {
  @Prop({
    required: true,
    type: Number,
  })
  chainIdOrig: ChainSchemaT['chainIdOrig'];

  @Prop({
    required: true,
    type: String,
  })
  name: ChainSchemaT['name'];

  @Prop({
    required: true,
    type: String,
  })
  nameShort: ChainSchemaT['nameShort'];

  @Prop({
    required: true,
    type: String,
  })
  infoUrl: ChainSchemaT['infoUrl'];

  @Prop({
    required: false,
    type: Boolean,
  })
  isDisabled: ChainSchemaT['isDisabled'];

  @Prop({
    required: true,
    type: {
      name: String,
      symbol: String,
      decimals: Number,
    },
  })
  nativeCurrency: ChainSchemaT['nativeCurrency'];
}

const schema = SchemaFactory.createForClass(Chain);

schema.plugin(aggregatePaginate);

export const ChainSchema = schema;
