import {
  Address,
  Hex,
} from 'viem';

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

export type AlchemyTransferCategoryT = (
  | 'external'
  | 'internal'
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'specialnft'
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
  category?: AlchemyTransferCategoryT[],
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
