import { Injectable } from '@nestjs/common';

import { ADDRESS_MODULES } from '../core/address-modules.keys';
import {
  AddressModuleResultT,
  AddressModuleT,
} from '../core/address-modules.types';

import { AddressActivityProviderFactory } from './factories';
import { AddressActivityDataT } from './types';

@Injectable()
export class AddressActivityModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressActivity;

  requires = [ADDRESS_MODULES.chainActivity];

  private readonly providerFactory = new AddressActivityProviderFactory();

  async run(params: Parameters<AddressModuleT['run']>[0]): Promise<AddressModuleResultT<AddressActivityDataT> | null> {
    const {
      address,
      chain,
    } = params;

    const provider = this.providerFactory.getProvider({
      chainIdOrig: chain.chainIdOrig,
    });

    try {
      const data = await provider.fetch({
        address,
        chainIdOrig: chain.chainIdOrig,
      });

      console.log('!!!', { data });

      return {
        key: this.key,
        chain,
        status: 'ok',
        data,
      };
    } catch (e) {
      return {
        key: this.key,
        chain,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }
}
