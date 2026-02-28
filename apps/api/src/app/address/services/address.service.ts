import {
  Injectable,
} from '@nestjs/common';

import pLimit from 'p-limit';
import {
  isAddress,
} from 'viem';

import { AddressFindOneT } from '@define/common/types';

import {
  httpExceptionBadRequest,
} from '@appApi/utils';

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
    query,
  }: {
    idWallet: string,
    query: AddressFindOneT['BASE'],
  }) {
    if (!isAddress(idWallet)) {
      httpExceptionBadRequest('Invalid address');
      throw new Error('');
    }

    const {
      hasList,
    } = query;

    const chainsOutMap: AddressFindOneT['RETURN_SRV']['chains'] = {};
    let chainsOutList: AddressFindOneT['RETURN_SRV']['chainsList'] = [];
    const address = idWallet;

    const chainsDb = await this.chainsService.getEnabledChains({
      // limit: 50,
      chainIdsOrig: [
        1, // Ethereum
        10, // Optimism
        137, // Polygon
        42161, // Arbitrum
        8453, // Base
      ],
    });

    const chains: AddressModulesChainCtxT[] = chainsDb.map((c) => {
      const res = {
        chainIdOrig: c.chainIdOrig,
        chainIdDb: c._id.toString(),
        name: c.name,
        nativeSymbol: c.nativeCurrency?.symbol,
        nativeDecimals: c.nativeCurrency?.decimals,
      };

      const k = c.chainIdOrig.toString();
      chainsOutMap[k] = {
        meta: {
          chainIdOrig: c.chainIdOrig,
          chainIdDb: c._id.toString(),
          name: c.name,
          nativeSymbol: c.nativeCurrency?.symbol,
          nativeDecimals: c.nativeCurrency?.decimals,
        },
        modules: {},
      };

      return res;
    });

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

    // result START
    results.forEach((r) => {
      if (!r) {
        return;
      }

      const chainKey = String(r.chain.chainIdOrig);

      // in case if chain was not added beforehand
      if (!chainsOutMap[chainKey]) {
        chainsOutMap[chainKey] = {
          meta: {
            chainIdOrig: r.chain.chainIdOrig,
            chainIdDb: r.chain.chainIdDb,
            name: r.chain.name,
            nativeSymbol: r.chain.nativeSymbol,
            nativeDecimals: r.chain.nativeDecimals,
          },
          modules: {},
        };
      }

      chainsOutMap[chainKey].modules[r.key] = {
        status: r.status,
        ...(r.data !== undefined ? { data: r.data as unknown } : {}),
        ...(r.error ? { error: r.error } : {}),
      };
    });

    if (hasList) {
      chainsOutList = Object.entries(chainsOutMap).map(([chainIdOrig, v]) => ({
        ...v,
        chainIdOrig: Number(chainIdOrig),
        meta: {
          ...(v.meta ?? {}),
          chainIdOrig: Number(chainIdOrig),
          chainIdDb: v.meta?.chainIdDb ?? '',
        },
      }));
    }
    // result END

    const res: AddressFindOneT['RETURN_SRV'] = {
      address,
      chains: chainsOutMap,
      chainsList: chainsOutList,
    };

    return res;
  }
}
