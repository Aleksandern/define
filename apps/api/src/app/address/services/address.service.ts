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

import {
  ADDRESS_MODULES,
  AddressActivityModule,
  // AddressAaveHfModule,
  // AddressAssetResolveModule,
  AddressChainActivityModule,
  AddressContractsInfoModule,
  AddressModulesChainCtxT,
  // AddressErc20ActivityModule,
  // AddressNativeBalanceModule,
  // AddressProtocolDiscoveryModule,
  // AddressScanModule,
  AddressModulesPipelineT,
  AddressProtocolResolveModule,
  AddressTouchedContractsModule,
  runModulesForChainPipeline,
} from '../modules';

@Injectable()
export class AddressService {
  constructor(
    private readonly chainsService: ChainsService,
    // private readonly nativeBalanceModule: AddressNativeBalanceModule,
    // private readonly aaveHfModule: AddressAaveHfModule,
    // private readonly protocolDiscoveryModule: AddressProtocolDiscoveryModule,
    private readonly chainActivityModule: AddressChainActivityModule,
    private readonly addressActivityModule: AddressActivityModule,
    private readonly addressTouchedContractsModule: AddressTouchedContractsModule,
    private readonly addressContractsInfoModule: AddressContractsInfoModule,
    private readonly addressProtocolResolveModule: AddressProtocolResolveModule,
    // private readonly erc20ActivityModule: AddressErc20ActivityModule,
    // private readonly scanModule: AddressScanModule,
    // private readonly assetResolveModule: AddressAssetResolveModule,
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
        // 10, // Optimism
        // 137, // Polygon
        // 42161, // Arbitrum
        // 8453, // Base
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

    const pipeline: AddressModulesPipelineT = [
      this.chainActivityModule,
      this.addressActivityModule,
      this.addressTouchedContractsModule,
      this.addressContractsInfoModule,
      this.addressProtocolResolveModule,
      // this.scanModule,
      // this.assetResolveModule,
      // this.erc20ActivityModule,
      // this.nativeBalanceModule,
      // this.aaveHfModule,
      // this.protocolDiscoveryModule,
    ];

    const limit = pLimit(5);

    const tasks = chains.map((chain) => limit(async () => {
      const chainKey = String(chain.chainIdOrig);

      const results = await runModulesForChainPipeline({
        address,
        chain,
        pipeline,
      });

      results.forEach((r) => {
        chainsOutMap[chainKey].modules[r.key] = {
          status: r.status,
          ...(r.data !== undefined ? { data: r.data } : {}),
          ...(r.error ? { error: r.error } : {}),
        };
      });

      // optionally: if chainActivity did not return (error/no rpc) - it will still be empty
      if (!chainsOutMap[chainKey].modules[ADDRESS_MODULES.chainActivity]) {
        chainsOutMap[chainKey].modules[ADDRESS_MODULES.chainActivity] = {
          status: 'error',
          error: 'chainActivity did not run',
        };
      }
    }));

    await Promise.all(tasks);

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
