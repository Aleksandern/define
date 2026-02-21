import { Types } from 'mongoose';

import { OmitStrict } from '../common/commonTypes';

export interface ChainsRpcT<SRV extends boolean = false> {
  _id: SRV extends true ? Types.ObjectId : string,
  createdAt: SRV extends true ? Date : string,
  updatedAt: SRV extends true ? Date : string,
  chainId: SRV extends true ? Types.ObjectId : string, // chainId in the database
  url: string,
  isPrimary?: boolean,
  cooldownUntil?: SRV extends true ? Date : string,
}

export type ChainsRpcSrvT = ChainsRpcT<true>;

export type ChainsRpcExcludeSrvT = OmitStrict<ChainsRpcSrvT,
'_id'
| 'updatedAt'
| 'createdAt'
>;

export type ChainsRpcSchemaT = Required<ChainsRpcExcludeSrvT>;

export type ChainsRpcCreateSrvT = ChainsRpcExcludeSrvT;
export type ChainsRpcUpdateSrvT = Partial<ChainsRpcCreateSrvT>;
