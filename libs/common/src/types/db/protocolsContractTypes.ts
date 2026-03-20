import { Types } from 'mongoose';

import { OmitStrict } from '../common/commonTypes';

import { ProtocolSourceP } from './protocolTypes';

export interface ProtocolsContractT<SRV extends boolean = false> {
  _id: SRV extends true ? Types.ObjectId : string,
  createdAt: SRV extends true ? Date : string,
  updatedAt: SRV extends true ? Date : string,
  protocolId: SRV extends true ? Types.ObjectId : string, // FK -> protocols.id
  protocolKey: string,
  chainId: SRV extends true ? Types.ObjectId : string, // chainId in the database
  chainIdOrig: number,
  address: string, // lowercase
  role?: string, // pool / router / factory / vault / oracle / token
  isProxy?: boolean,
  implementationAddress?: string,
  source: ProtocolSourceP,
  sourceRef?: string,
  confidence: number, // 0..100
  firstSeenAt?: Date,
  lastConfirmedAt?: Date,
}

export type ProtocolsContractSrvT = ProtocolsContractT<true>;

export type ProtocolsContractExcludeSrvT = OmitStrict<ProtocolsContractSrvT,
'_id'
| 'updatedAt'
| 'createdAt'
>;

export type ProtocolsContractSchemaT = Required<ProtocolsContractExcludeSrvT>;

export type ProtocolsContractCreateSrvT = ProtocolsContractExcludeSrvT;
export type ProtocolsContractUpdateSrvT = Partial<ProtocolsContractCreateSrvT>;
