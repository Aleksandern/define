import { Injectable } from '@nestjs/common';

import type { Address } from 'viem';

import { getAaveV3MarketsByChainId } from '@appApi/chains/aave';

import type {
  AddressContractsInfoDataT,
} from '../contracts-info';
import { ADDRESS_MODULES } from '../core/address-modules.keys';
import type {
  AddressModuleResultT,
  AddressModuleT,
} from '../core/address-modules.types';

import {
  ProtocolRegistryService,
} from './protocol-registry.service';
import type {
  ProtocolResolveItemT,
} from './protocol-registry.types';

export interface AddressProtocolResolveDataT {
  items: ProtocolResolveItemT[],
  protocolKeys: string[],
}

@Injectable()
export class AddressProtocolResolveModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressProtocolResolve;

  requires = [ADDRESS_MODULES.addressContractsInfo];

  private readonly protocolRegistryService = new ProtocolRegistryService();

  async run(
    params: Parameters<AddressModuleT['run']>[0],
  ): Promise<AddressModuleResultT<AddressProtocolResolveDataT> | null> {
    const {
      chain,
      ctx,
    } = params;

    const contractsInfo = ctx.data[ADDRESS_MODULES.addressContractsInfo] as AddressContractsInfoDataT | undefined;

    if (!contractsInfo) {
      return null;
    }

    const matches = await this.protocolRegistryService.findByContracts({
      chainIdOrig: chain.chainIdOrig,
      contracts: contractsInfo.protocolContractCandidates,
    });

    const aaveMarkets = getAaveV3MarketsByChainId({
      chainIdOrig: params.chain.chainIdOrig,
    });

    console.log('!!!', { aaveMarkets });

    const grouped = new Map<string, {
      protocolKey: string,
      protocolName: string,
      contracts: Set<string>,
      contractRoles: Set<string>,
    }>();

    matches.forEach((match) => {
      if (!grouped.has(match.protocolKey)) {
        grouped.set(match.protocolKey, {
          protocolKey: match.protocolKey,
          protocolName: match.protocolName,
          contracts: new Set<string>(),
          contractRoles: new Set<string>(),
        });
      }

      const item = grouped.get(match.protocolKey);

      if (!item) {
        return;
      }

      item.contracts.add(match.contractAddress.toLowerCase());

      if (match.contractRole) {
        item.contractRoles.add(match.contractRole);
      }
    });

    const items: ProtocolResolveItemT[] = Array.from(grouped.values()).map((item) => ({
      protocolKey: item.protocolKey,
      protocolName: item.protocolName,
      contracts: Array.from(item.contracts) as Address[],
      contractRoles: Array.from(item.contractRoles),
    }));

    const data = {
      items,
      protocolKeys: items.map((item) => item.protocolKey),
    };

    console.log('!!!resolve', { data });

    return {
      key: this.key,
      chain,
      status: 'ok',
      data,
    };
  }
}
