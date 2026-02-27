import {
  Injectable,
} from '@nestjs/common';

import pLimit from 'p-limit';
import {
  Address,
  isAddress,
} from 'viem';

import { AddressFindOneT } from '@define/common/types';

import { httpExceptionBadRequest } from '@appApi/utils';

import { ChainsService } from '@appApi/app/chains/services';

import { AddressNativeBalanceModule } from '../modules';
import {
  AddressModulesChainCtxT,
  AddressModuleT,
} from '../types';

@Injectable()
export class AddressService {
  constructor(
    private readonly chainsService: ChainsService,
    private readonly nativeBalanceModule: AddressNativeBalanceModule,
  ) {}

  async findOne({
    idWallet,
  }: {
    idWallet: string,
  }) {
    if (!isAddress(idWallet)) {
      httpExceptionBadRequest('Invalid address');
    }
    const address = idWallet as Address;

    const chainsDb = await this.chainsService.getEnabledChains({
      // limit: 50,
      chainIdsOrig: [1, 10, 137, 42161, 8453], // for testing
    });

    const chains: AddressModulesChainCtxT[] = chainsDb.map((c) => ({
      chainIdOrig: c.chainIdOrig,
      chainIdDb: c._id.toString(),
      name: c.name,
      nativeSymbol: c.nativeCurrency?.symbol,
      nativeDecimals: c.nativeCurrency?.decimals,
    }));

    const modules: AddressModuleT[] = [
      this.nativeBalanceModule,
    ];

    const limit = pLimit(5);

    const tasks = chains.flatMap((chain) => (
      modules.map((mod) => (
        limit(() => mod.run({
          address,
          chain,
        }))
      ))
    ));

    const results = await Promise.all(tasks);

    console.log('[ !!!results ]', results);

    return 'ok' as unknown as AddressFindOneT['RETURN_SRV'];
  }
}
