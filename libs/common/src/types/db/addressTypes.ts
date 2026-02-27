// find one START

import { ApiSchemaT } from '../common/apiTypes';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type AddressFindOneResultT = {
  balance: number,
};

export type AddressFindOneT = ApiSchemaT<{
  BASE: undefined,
  DTO: undefined,
  RETURN: AddressFindOneResultT,
  RETURN_SRV: AddressFindOneResultT,
}>;
// find one END
