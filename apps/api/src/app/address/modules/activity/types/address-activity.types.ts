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

/**
 * Sort order
 */
export type AlchemyTransferOrderT = (
  | 'asc'
  | 'desc'
);

/**
 * Hex block tag used by Alchemy
 */
export type AlchemyBlockTagT = (
  | 'latest'
  | Hex
);

/**
 * Parameters for alchemy_getAssetTransfers
 *
 * https://docs.alchemy.com/reference/alchemy-getassettransfers
 */
export interface AlchemyGetAssetTransfersParamsT {
  fromBlock?: AlchemyBlockTagT,
  toBlock?: AlchemyBlockTagT,
  fromAddress?: Address,
  toAddress?: Address,
  excludeZeroValue?: boolean,
  category?: AddressActivityTransferCategoryT[],
  contractAddresses?: Address[],
  order?: AlchemyTransferOrderT,
  withMetadata?: boolean,
  /**
   * Hex number
   * example: "0x3e8"
   */
  maxCount?: Hex,
  /**
   * Pagination cursor
   */
  pageKey?: string,
}
