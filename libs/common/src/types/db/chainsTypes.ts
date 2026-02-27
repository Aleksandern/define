import { Types } from 'mongoose';

import { OmitStrict } from '../common/commonTypes';

export interface ChainT<SRV extends boolean = false> {
  _id: SRV extends true ? Types.ObjectId : string,
  createdAt: SRV extends true ? Date : string,
  updatedAt: SRV extends true ? Date : string,
  chainIdOrig: number, // chainId in chainlist
  name: string,
  nameShort: string,
  infoUrl: string,
  isDisabled?: boolean,
  nativeCurrency: {
    name: string,
    symbol: string,
    decimals: number,
  },
}

export type ChainSrvT = ChainT<true>;

export type ChainExcludeSrvT = OmitStrict<ChainSrvT,
'_id'
| 'updatedAt'
| 'createdAt'
>;

export type ChainSchemaT = Required<ChainExcludeSrvT>;

export type ChainCreateSrvT = ChainExcludeSrvT;
export type ChainUpdateSrvT = Partial<ChainCreateSrvT>;
