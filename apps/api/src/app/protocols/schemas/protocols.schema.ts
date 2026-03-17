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
  ProtocolSchemaT,
  ProtocolSourceP,
} from '@define/common/types';

import { SchemaTimestampsConfig } from '@appApi/types';

export type ProtocolDocument = Protocol & Document<Types.ObjectId> & SchemaTimestampsConfig;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class Protocol implements ProtocolSchemaT {
  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  })
  key: ProtocolSchemaT['key'];

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  slug: ProtocolSchemaT['slug'];

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  name: ProtocolSchemaT['name'];

  @Prop({
    type: String,
    required: false,
    trim: true,
    lowercase: true,
  })
  family: ProtocolSchemaT['family'];

  @Prop({
    type: String,
    required: false,
    trim: true,
  })
  website: ProtocolSchemaT['website'];

  @Prop({
    type: String,
    required: true,
    enum: ProtocolSourceP,
    index: true,
  })
  source: ProtocolSchemaT['source'];

  @Prop({
    type: String,
    required: false,
  })
  source_ref: ProtocolSchemaT['source_ref'];

  @Prop({
    type: Boolean,
    required: false,
  })
  isDisabled: ProtocolSchemaT['isDisabled'];
}

const schema = SchemaFactory.createForClass(Protocol);

schema.plugin(aggregatePaginate);

export const ProtocolSchema = schema;
