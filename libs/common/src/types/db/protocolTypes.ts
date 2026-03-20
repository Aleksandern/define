import { Types } from 'mongoose';

import { OmitStrict } from '../common/commonTypes';

export enum ProtocolSourceP {
  defillama = 'defillama',
  manual = 'manual',
  aaveAddressBook = 'aaveAddressBook',
}

export interface ProtocolT<SRV extends boolean = false> {
  _id: SRV extends true ? Types.ObjectId : string,
  createdAt: SRV extends true ? Date : string,
  updatedAt: SRV extends true ? Date : string,
  key: string, // "aave_v3", "uniswap_v3"
  slug?: string, // внешний slug, например defillama slug
  name: string, // "Aave V3"
  family?: string, // lending, dex, vault, bridge
  website?: string,
  source: ProtocolSourceP,
  source_ref?: string, // url / repo path / adapter path
  isDisabled?: boolean,
}

export type ProtocolSrvT = ProtocolT<true>;

export type ProtocolExcludeSrvT = OmitStrict<ProtocolSrvT,
'_id'
| 'updatedAt'
| 'createdAt'
>;

export type ProtocolSchemaT = Required<ProtocolExcludeSrvT>;

export type ProtocolCreateSrvT = ProtocolExcludeSrvT;
export type ProtocolUpdateSrvT = Partial<ProtocolCreateSrvT>;
