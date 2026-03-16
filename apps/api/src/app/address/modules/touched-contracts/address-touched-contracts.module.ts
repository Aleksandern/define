import { Injectable } from '@nestjs/common';

import type { Address } from 'viem';

import type {
  AddressActivityDataT,
} from '../activity/types';
import { ADDRESS_MODULES } from '../core/address-modules.keys';
import type {
  AddressModuleResultT,
  AddressModuleT,
} from '../core/address-modules.types';

export interface AddressTouchedContractsDataT {
  contracts: Address[],
}

@Injectable()
export class AddressTouchedContractsModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressTouchedContracts;

  requires = [ADDRESS_MODULES.addressActivity];

  async run(
    params: Parameters<AddressModuleT['run']>[0],
  ): Promise<AddressModuleResultT<AddressTouchedContractsDataT> | null> {
    const {
      chain,
      ctx,
    } = params;

    const activity = ctx.data[ADDRESS_MODULES.addressActivity] as AddressActivityDataT | undefined;

    if (!activity) {
      return null;
    }

    const contracts = activity.touchedContracts;

    return {
      key: this.key,
      chain,
      status: 'ok',
      data: {
        contracts,
      },
    };
  }
}
