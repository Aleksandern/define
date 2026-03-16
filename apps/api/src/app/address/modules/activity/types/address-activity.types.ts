import type {
  Address,
  Hex,
} from 'viem';

export type AddressActivityTransferCategoryT = (
  | 'external'
  | 'internal'
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'specialnft'
  | 'unknown'
);

export interface AddressActivityTransferT {
  txHash?: Hex,
  from?: Address,
  to?: Address,
  contractAddress?: Address,
  category: AddressActivityTransferCategoryT,
  value?: string,
  blockNumber?: string,
  raw?: unknown,
}

export interface AddressActivityTxT {
  hash: Hex,
  from?: Address,
  to?: Address,
  blockNumber?: string,
  raw?: unknown,
}

export interface AddressActivityLogT {
  address: Address,
  topics: Hex[],
  data: Hex,
  txHash?: Hex,
  blockNumber?: string,
  logIndex?: string,
  raw?: unknown,
}

export interface AddressActivityDataT {
  source: 'alchemy' | 'rpc' | 'covalent' | 'unknown',

  txs: AddressActivityTxT[],
  logs: AddressActivityLogT[],
  transfers: AddressActivityTransferT[],

  touchedContracts: Address[],

  incomingNextCursor?: string,
  outgoingNextCursor?: string,

  scannedFromBlock?: string,
  scannedToBlock?: string,
  note?: string,
}

export interface AddressActivityProviderT {
  fetch(params: {
    address: Address,
    chainIdOrig: number,
  }): Promise<AddressActivityDataT>,
}
