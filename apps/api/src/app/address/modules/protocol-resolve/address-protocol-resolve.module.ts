import {
  Injectable,
} from '@nestjs/common';

import type { Address } from 'viem';

import type {
  ProtocolsContractSrvT,
} from '@define/common/types';

import {
  ProtocolsContractsService,
} from '@appApi/app/protocols/services';

import type {
  AddressContractsInfoDataT,
} from '../contracts-info';
import { ADDRESS_MODULES } from '../core/address-modules.keys';
import type {
  AddressModuleResultT,
  AddressModuleT,
} from '../core/address-modules.types';

export interface AddressProtocolResolveItemT {
  protocolId: string,
  protocolKey: string,
  protocolName?: string,
  contracts: Address[],
  contractRoles: string[],
  matchedRowsCount: number,
  matches: ProtocolsContractSrvT[],
}

export interface AddressProtocolResolveDataT {
  items: AddressProtocolResolveItemT[],
  protocolKeys: string[],
}

@Injectable()
export class AddressProtocolResolveModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressProtocolResolve;

  requires = [ADDRESS_MODULES.addressContractsInfo];

  constructor(
    private readonly protocolsContractsService: ProtocolsContractsService,
  ) {}

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

    if (contractsInfo.protocolContractCandidates.length === 0) {
      return {
        key: this.key,
        chain,
        status: 'ok',
        data: {
          items: [],
          protocolKeys: [],
        },
      };
    }

    const matches = await this.protocolsContractsService.findBy({
      query: {
        chainIdOrig: chain.chainIdOrig,
        address: contractsInfo.protocolContractCandidates,
      },
    });

    const grouped = new Map<string, {
      protocolId: string,
      protocolKey: string,
      protocolName?: string,
      contracts: Set<Address>,
      contractRoles: Set<string>,
      matches: ProtocolsContractSrvT[],
    }>();

    matches.forEach((match) => {
      const protocolId = String(match.protocolId);
      const existing = grouped.get(protocolId);

      if (existing) {
        existing.contracts.add(match.address as Address);

        if (match.role) {
          existing.contractRoles.add(match.role);
        }

        if (!existing.protocolName && match.protocol?.name) {
          existing.protocolName = match.protocol.name;
        }

        existing.matches.push(match);

        return;
      }

      const contracts = new Set<Address>([
        match.address as Address,
      ]);
      const contractRoles = new Set<string>();

      if (match.role) {
        contractRoles.add(match.role);
      }

      grouped.set(protocolId, {
        protocolId,
        protocolKey: match.protocolKey,
        protocolName: match.protocol?.name,
        contracts,
        contractRoles,
        matches: [match],
      });
    });

    const items: AddressProtocolResolveItemT[] = [...grouped.values()].map((item) => ({
      protocolId: item.protocolId,
      protocolKey: item.protocolKey,
      protocolName: item.protocolName,
      contracts: [...item.contracts],
      contractRoles: [...item.contractRoles],
      matchedRowsCount: item.matches.length,
      matches: item.matches,
    }));

    const data = {
      items,
      protocolKeys: items.map((item) => item.protocolKey),
    };

    return {
      key: this.key,
      chain,
      status: 'ok',
      data,
    };
  }
}
