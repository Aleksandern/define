import type { Address } from 'viem';

export interface ProtocolRegistryMatchT {
  protocolKey: string,
  protocolName: string,
  contractAddress: Address,
  contractRole?: string,
}

export interface ProtocolResolveItemT {
  protocolKey: string,
  protocolName: string,
  contracts: Address[],
  contractRoles?: string[],
}
