import {
  Injectable,
} from '@nestjs/common';

import * as AaveAddressBook from '@aave-dao/aave-address-book';
import { Types } from 'mongoose';

import {
  ProtocolSourceP,
} from '@define/common/types';

import { getAaveV3MarketsByChainId } from '@appApi/chains/aave';
import { dbUtils } from '@appApi/utils';

import { ChainsService } from '@appApi/app/chains/services';

import type {
  ProtocolsSourceContractT,
  ProtocolsSourcePayloadT,
  ProtocolsSourceProtocolT,
  ProtocolsSourceProviderT,
} from '../types/protocols-source.types';

interface AaveMarketEntryT {
  CHAIN_ID?: number,
  [key: string]: unknown,
}

interface AddressBookExportEntryT {
  exportName: string,
  market: AaveMarketEntryT,
}

interface ChainLookupT {
  _id: Types.ObjectId,
  chainIdOrig: number,
}

@Injectable()
export class ProtocolsSourceAaveAddressBookProvider implements ProtocolsSourceProviderT {
  readonly source = ProtocolSourceP.aaveAddressBook;

  constructor(
    private readonly chainsService: ChainsService,
  ) {}

  async load(): Promise<ProtocolsSourcePayloadT> {
    const entries = this.extractAddressBookEntries();
    const chainByChainIdOrig = await this.resolveChainsMap({
      chainIdsOrig: this.extractUniqueChainIds({
        entries,
      }),
    });

    const protocolsMap = new Map<string, ProtocolsSourceProtocolT>();
    const contracts: ProtocolsSourceContractT[] = [];

    entries.forEach((entry) => {
      this.appendContractsFromAddressBookEntry({
        entry,
        chainByChainIdOrig,
        protocolsMap,
        contracts,
      });
    });

    this.appendAaveV3CoreMarkets({
      chainByChainIdOrig,
      protocolsMap,
      contracts,
    });

    return {
      protocols: [...protocolsMap.values()],
      contracts: this.dedupeContracts({
        items: contracts,
      }),
    };
  }

  private extractAddressBookEntries(): AddressBookExportEntryT[] {
    return Object.entries(
      AaveAddressBook as Record<string, unknown>,
    )
      .map(([exportName, exportValue]) => {
        const market = this.asMarketEntry({
          value: exportValue,
        });

        if (!market) {
          return null;
        }

        return {
          exportName,
          market,
        };
      })
      .filter((item): item is AddressBookExportEntryT => Boolean(item));
  }

  private extractUniqueChainIds(params: {
    entries: AddressBookExportEntryT[],
  }): number[] {
    const {
      entries,
    } = params;

    return [...new Set(
      entries
        .map((entry) => entry.market.CHAIN_ID)
        .filter((value): value is number => typeof value === 'number'),
    )];
  }

  private async resolveChainsMap(params: {
    chainIdsOrig: number[],
  }): Promise<Map<number, ChainLookupT>> {
    const {
      chainIdsOrig,
    } = params;

    const resolved = await Promise.all(
      chainIdsOrig.map(async (chainIdOrig) => {
        const found = await this.chainsService.findOneBy({
          chainIdOrig,
        });

        if (!found) {
          return null;
        }

        return {
          chainIdOrig,
          chain: {
            _id: found._id,
            chainIdOrig: found.chainIdOrig,
          },
        };
      }),
    );

    const items = resolved.filter(Boolean) as {
      chainIdOrig: number,
      chain: ChainLookupT,
    }[];

    const res = new Map(
      items.map((item) => [item.chainIdOrig, item.chain]),
    );

    return res;
  }

  private appendContractsFromAddressBookEntry(params: {
    entry: AddressBookExportEntryT,
    chainByChainIdOrig: Map<number, ChainLookupT>,
    protocolsMap: Map<string, ProtocolsSourceProtocolT>,
    contracts: ProtocolsSourceContractT[],
  }): void {
    const {
      entry,
      chainByChainIdOrig,
      protocolsMap,
      contracts,
    } = params;

    const {
      exportName,
      market,
    } = entry;

    const chainIdOrig = market.CHAIN_ID;

    if (typeof chainIdOrig !== 'number') {
      return;
    }

    const chain = chainByChainIdOrig.get(chainIdOrig);

    if (!chain) {
      return;
    }

    const protocolMeta = this.resolveProtocolMeta({
      exportName,
    });

    this.ensureProtocol({
      protocolsMap,
      protocol: {
        key: protocolMeta.key,
        slug: protocolMeta.key,
        name: protocolMeta.name,
        family: protocolMeta.family,
        website: 'https://aave.com',
        source: ProtocolSourceP.aaveAddressBook,
        source_ref: exportName,
        isDisabled: false,
      },
    });

    Object.entries(market).forEach(([fieldName, fieldValue]) => {
      const address = this.asAddressLikeValue({
        value: fieldValue,
      });

      if (!address) {
        return;
      }

      contracts.push({
        protocolKey: protocolMeta.key,
        chainId: dbUtils.idToObjectId(String(chain._id)),
        chainIdOrig,
        address: address.toLowerCase(),
        role: this.normalizeRole({
          fieldName,
        }),
        source: ProtocolSourceP.aaveAddressBook,
        sourceRef: exportName,
        confidence: 100,
      });
    });
  }

  private appendAaveV3CoreMarkets(params: {
    chainByChainIdOrig: Map<number, ChainLookupT>,
    protocolsMap: Map<string, ProtocolsSourceProtocolT>,
    contracts: ProtocolsSourceContractT[],
  }): void {
    const {
      chainByChainIdOrig,
      protocolsMap,
      contracts,
    } = params;

    this.ensureProtocol({
      protocolsMap,
      protocol: {
        key: 'aave_v3',
        slug: 'aave_v3',
        name: 'Aave V3',
        family: 'lending',
        website: 'https://aave.com',
        source: ProtocolSourceP.aaveAddressBook,
        source_ref: 'aave-markets.registry',
        isDisabled: false,
      },
    });

    [...chainByChainIdOrig.entries()].forEach(([chainIdOrig, chain]) => {
      const markets = getAaveV3MarketsByChainId({
        chainIdOrig,
      });

      markets.forEach((market) => {
        const chainId = dbUtils.idToObjectId(String(chain._id));

        contracts.push({
          protocolKey: 'aave_v3',
          chainId,
          chainIdOrig: market.chainId,
          address: market.pool.toLowerCase(),
          role: 'pool',
          source: ProtocolSourceP.aaveAddressBook,
          sourceRef: market.key,
          confidence: 100,
        });

        contracts.push({
          protocolKey: 'aave_v3',
          chainId,
          chainIdOrig: market.chainId,
          address: market.provider.toLowerCase(),
          role: 'pool_addresses_provider',
          source: ProtocolSourceP.aaveAddressBook,
          sourceRef: market.key,
          confidence: 100,
        });

        contracts.push({
          protocolKey: 'aave_v3',
          chainId,
          chainIdOrig: market.chainId,
          address: market.uiPoolDataProvider.toLowerCase(),
          role: 'ui_pool_data_provider',
          source: ProtocolSourceP.aaveAddressBook,
          sourceRef: market.key,
          confidence: 100,
        });
      });
    });
  }

  private ensureProtocol(params: {
    protocolsMap: Map<string, ProtocolsSourceProtocolT>,
    protocol: ProtocolsSourceProtocolT,
  }): void {
    const {
      protocolsMap,
      protocol,
    } = params;

    if (!protocolsMap.has(protocol.key)) {
      protocolsMap.set(protocol.key, protocol);
    }
  }

  private asMarketEntry(params: {
    value: unknown,
  }): AaveMarketEntryT | null {
    const {
      value,
    } = params;

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const record = value as Record<string, unknown>;

    if (typeof record.CHAIN_ID !== 'number') {
      return null;
    }

    return record as AaveMarketEntryT;
  }

  private asAddressLikeValue(params: {
    value: unknown,
  }): string | null {
    const {
      value,
    } = params;

    if (
      typeof value === 'string'
      && /^0x[a-fA-F0-9]{40}$/.test(value)
    ) {
      return value;
    }

    return null;
  }

  private resolveProtocolMeta(params: {
    exportName: string,
  }): {
    key: string,
    name: string,
    family: string,
  } {
    const {
      exportName,
    } = params;

    const lower = exportName.toLowerCase();

    if (lower.startsWith('aavev3')) {
      return {
        key: 'aave_v3',
        name: 'Aave V3',
        family: 'lending',
      };
    }

    if (lower.startsWith('aavev2')) {
      return {
        key: 'aave_v2',
        name: 'Aave V2',
        family: 'lending',
      };
    }

    if (lower.startsWith('gho')) {
      return {
        key: 'gho',
        name: 'GHO',
        family: 'stablecoin',
      };
    }

    return {
      key: 'aave',
      name: 'Aave',
      family: 'lending',
    };
  }

  private normalizeRole(params: {
    fieldName: string,
  }): string {
    const {
      fieldName,
    } = params;

    return fieldName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private dedupeContracts(params: {
    items: ProtocolsSourceContractT[],
  }): ProtocolsSourceContractT[] {
    const {
      items,
    } = params;

    const map = new Map<string, ProtocolsSourceContractT>();

    items.forEach((item) => {
      const dedupeKey = [
        item.protocolKey.toLowerCase(),
        item.chainIdOrig,
        item.address.toLowerCase(),
      ].join(':');

      const normalized: ProtocolsSourceContractT = {
        ...item,
        protocolKey: item.protocolKey.toLowerCase(),
        address: item.address.toLowerCase(),
        role: item.role?.toLowerCase(),
        implementationAddress: item.implementationAddress?.toLowerCase(),
      };

      if (!map.has(dedupeKey)) {
        map.set(dedupeKey, normalized);
      }
    });

    return [...map.values()];
  }
}
