import { ApiSchemaT } from '../common/apiTypes';

// find one START
export interface AddressFindOneResultMetaT {
  chainIdOrig: number,
  chainIdDb: string,
  name?: string,
  nativeSymbol?: string,
  nativeDecimals?: number,
}

export interface AddressFindOneResultChainEntryT {
  meta?: AddressFindOneResultMetaT,
  modules: Record<
    string,
    {
      status: 'ok' | 'error',
      data?: unknown,
      error?: string,
    }
  >,
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type AddressFindOneResultT = {
  address: string,
  chains: Record<
    string, // chainIdOrig как строка ключа
    AddressFindOneResultChainEntryT
  >,
  chainsList: ({ chainIdOrig: number } & AddressFindOneResultChainEntryT)[],
};

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type AddressFindOneBaseT = {
  hasList?: boolean,
};

export type AddressFindOneT = ApiSchemaT<{
  BASE: AddressFindOneBaseT,
  DTO: Required<AddressFindOneBaseT>,
  RETURN: AddressFindOneResultT,
  RETURN_SRV: AddressFindOneResultT,
}>;
// find one END
