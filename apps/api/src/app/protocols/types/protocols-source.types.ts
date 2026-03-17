import type {
  OmitStrict,
  ProtocolCreateSrvT,
  ProtocolsContractCreateSrvT,
  ProtocolSourceP,
} from '@define/common/types';

export type ProtocolsSourceProtocolT = ProtocolCreateSrvT;

export type ProtocolsSourceContractT = OmitStrict<
  ProtocolsContractCreateSrvT,
  'protocolId'
>;

export interface ProtocolsSourcePayloadT {
  protocols: ProtocolsSourceProtocolT[],
  contracts: ProtocolsSourceContractT[],
}

export interface ProtocolsSourceProviderT {
  readonly source: ProtocolSourceP,

  load(params?: {
    limitProtocols?: number,
  }): Promise<ProtocolsSourcePayloadT>,
}
