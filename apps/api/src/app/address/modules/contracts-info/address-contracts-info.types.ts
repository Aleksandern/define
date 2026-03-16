import type { Address } from 'viem';

import { AddressKindT } from '../core/address-modules.types';

export type AddressContractsKindT = AddressKindT;

export interface AddressContractsInfoT {
  address: Address,
  isContract: boolean,
  kind: AddressContractsKindT,

  symbol?: string,
  name?: string,
  decimals?: number,

  supportsErc165?: boolean,
  supportsErc721?: boolean,
  supportsErc1155?: boolean,
}
