import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import type {
  AggregatePaginateModel,
} from 'mongoose';

import {
  Chain,
  ChainDocument,
} from '../schemas';

@Injectable()
export class ChainsService {
  constructor(
    // @ts-ignore
    @InjectModel(Chain.name) private rpcModel: AggregatePaginateModel<ChainDocument>,
  ) {}
}
