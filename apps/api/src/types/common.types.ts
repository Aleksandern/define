import type {
  Express as _Express,
  Request as RequestOrig,
} from 'express';
import {
  SchemaTimestampsConfig as SchemaTimestampsConfigOrig,
} from 'mongoose';

import {
  UndefinableToOptionalT,
} from '@define/common/types';

export interface SchemaTimestampsConfig extends SchemaTimestampsConfigOrig {
  createdAt: string,
  updatedAt: string,
}

export interface Request extends RequestOrig {
  user: {
    id: string,
  },
}

export interface RequestHeadersT {
  'x-timezone'?: string,
}

export type AggrRelationOptionsT<T = undefined> = {
  show?: boolean,
} & UndefinableToOptionalT<{
  options: T,
}>;

export type ItemCondT<T> = Partial<Record<Partial<keyof T> | '$and' | '$or', any>>;
