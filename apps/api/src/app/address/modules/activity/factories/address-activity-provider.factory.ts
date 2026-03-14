import { AddressActivityAlchemyProvider } from '../providers';
import { AddressActivityProviderT } from '../types';

export class AddressActivityProviderFactory {
  getProvider({
    chainIdOrig: _chainIdOrig,
  }: {
    chainIdOrig: number,
  }): AddressActivityProviderT {
    const res = new AddressActivityAlchemyProvider();

    return res;
  }
}
