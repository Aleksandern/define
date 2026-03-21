import {
  Injectable,
} from '@nestjs/common';

import type {
  Types,
} from 'mongoose';

import {
  ProtocolSourceP,
} from '@define/common/types';

import {
  ProtocolsSourceAaveAddressBookProvider,
  ProtocolsSourceDefiLlamaProvider,
} from '../providers';
import type {
  ProtocolsSourceContractT,
  ProtocolsSourceProtocolT,
  ProtocolsSourceProviderT,
} from '../types/protocols-source.types';

import { ProtocolsService } from './protocols.service';
import { ProtocolsContractsService } from './protocols-contracts.service';

const SOURCE_PRIORITY: Record<string, number> = {
  [ProtocolSourceP.aaveAddressBook]: 100,
  [ProtocolSourceP.defillama]: 50,
};

@Injectable()
export class ProtocolsSourceSyncService {
  private readonly providers: ProtocolsSourceProviderT[];

  constructor(
    private readonly protocolsService: ProtocolsService,
    private readonly protocolsContractsService: ProtocolsContractsService,
    private readonly protocolsSourceDefiLlamaProvider: ProtocolsSourceDefiLlamaProvider,
    private readonly protocolsSourceAaveAddressBookProvider: ProtocolsSourceAaveAddressBookProvider,
  ) {
    this.providers = [
      this.protocolsSourceDefiLlamaProvider,
      this.protocolsSourceAaveAddressBookProvider,
    ];
  }

  async syncAll(params?: {
    limitProtocols?: number,
  }): Promise<{
    protocolsUpserted: number,
    contractsUpserted: number,
  }> {
    const protocolsMap = new Map<string, ProtocolsSourceProtocolT>();
    const contractsMap = new Map<string, ProtocolsSourceContractT>();

    await this.providers.reduce(async (prev, provider) => {
      await prev;

      const payload = await provider.load({
        limitProtocols: params?.limitProtocols ?? 200,
      });

      this.mergePayloadIntoMaps({
        payload,
        protocolsMap,
        contractsMap,
      });
    }, Promise.resolve());

    const mergedProtocols = [...protocolsMap.values()];
    const mergedContracts = [...contractsMap.values()];

    const protocolIdByKey = await this.upsertProtocols({
      items: mergedProtocols,
    });

    const contractsToSave = this.buildContractsToSave({
      items: mergedContracts,
      protocolIdByKey,
    });

    await this.protocolsContractsService.bulkUpsert({
      items: contractsToSave,
    });

    return {
      protocolsUpserted: mergedProtocols.length,
      contractsUpserted: contractsToSave.length,
    };
  }

  private mergePayloadIntoMaps(params: {
    payload: {
      protocols: ProtocolsSourceProtocolT[],
      contracts: ProtocolsSourceContractT[],
    },
    protocolsMap: Map<string, ProtocolsSourceProtocolT>,
    contractsMap: Map<string, ProtocolsSourceContractT>,
  }): void {
    const {
      payload,
      protocolsMap,
      contractsMap,
    } = params;

    payload.protocols.forEach((protocol) => {
      const protocolKey = protocol.key.toLowerCase();
      const normalizedProtocol: ProtocolsSourceProtocolT = {
        ...protocol,
        key: protocolKey,
      };

      if (!protocolsMap.has(protocolKey)) {
        protocolsMap.set(protocolKey, normalizedProtocol);

        return;
      }

      const current = protocolsMap.get(protocolKey);

      if (!current) {
        return;
      }

      const winner = this.mergeProtocols({
        current,
        next: normalizedProtocol,
      });

      protocolsMap.set(protocolKey, winner);
    });

    payload.contracts.forEach((contract) => {
      const dedupeKey = this.buildContractDedupeKey({
        item: contract,
      });

      if (!contractsMap.has(dedupeKey)) {
        contractsMap.set(dedupeKey, this.normalizeContract({
          item: contract,
        }));

        return;
      }

      const current = contractsMap.get(dedupeKey);

      if (!current) {
        return;
      }

      const winner = this.mergeContracts({
        current,
        next: contract,
      });

      contractsMap.set(dedupeKey, winner);
    });
  }

  private async upsertProtocols(params: {
    items: ProtocolsSourceProtocolT[],
  }): Promise<Map<string, Types.ObjectId>> {
    const {
      items,
    } = params;

    const savedItems = await Promise.all(
      items.map((item) => this.protocolsService.upsertOne({
        item: {
          ...item,
          key: item.key.toLowerCase(),
        },
      })),
    );

    return new Map(
      savedItems.map((item) => [item.key.toLowerCase(), item._id]),
    );
  }

  private buildContractsToSave(params: {
    items: ProtocolsSourceContractT[],
    protocolIdByKey: Map<string, Types.ObjectId>,
  }): (ProtocolsSourceContractT & {
    protocolId: Types.ObjectId,
  })[] {
    const {
      items,
      protocolIdByKey,
    } = params;

    return items
      .map((item) => {
        const protocolKey = item.protocolKey.toLowerCase();
        const protocolId = protocolIdByKey.get(protocolKey);

        if (!protocolId) {
          return null;
        }

        return {
          ...this.normalizeContract({
            item,
          }),
          protocolId,
        };
      })
      .filter((item): item is ProtocolsSourceContractT & { protocolId: Types.ObjectId } => Boolean(item));
  }

  private mergeProtocols(params: {
    current: ProtocolsSourceProtocolT,
    next: ProtocolsSourceProtocolT,
  }): ProtocolsSourceProtocolT {
    const {
      current,
      next,
    } = params;

    const currentScore = this.getSourcePriority({
      source: current.source,
    });
    const nextScore = this.getSourcePriority({
      source: next.source,
    });

    if (nextScore > currentScore) {
      return next;
    }

    return current;
  }

  private normalizeContract(params: {
    item: ProtocolsSourceContractT,
  }): ProtocolsSourceContractT {
    const {
      item,
    } = params;

    return {
      ...item,
      protocolKey: item.protocolKey.toLowerCase(),
      address: item.address.toLowerCase(),
      role: item.role?.toLowerCase(),
      implementationAddress: item.implementationAddress?.toLowerCase(),
      confidence: item.confidence ?? 100,
      isProxy: item.isProxy ?? false,
    };
  }

  private mergeContracts(params: {
    current: ProtocolsSourceContractT,
    next: ProtocolsSourceContractT,
  }): ProtocolsSourceContractT {
    const {
      current,
      next,
    } = params;

    const currentNorm = this.normalizeContract({
      item: current,
    });
    const nextNorm = this.normalizeContract({
      item: next,
    });

    const currentScore = this.getContractScore({
      item: currentNorm,
    });
    const nextScore = this.getContractScore({
      item: nextNorm,
    });

    if (nextScore > currentScore) {
      return nextNorm;
    }

    return currentNorm;
  }

  private getContractScore(params: {
    item: ProtocolsSourceContractT,
  }): number {
    const {
      item,
    } = params;

    const confidence = item.confidence ?? 0;
    const sourcePriority = this.getSourcePriority({
      source: item.source,
    });

    return confidence + sourcePriority;
  }

  private getSourcePriority(params: {
    source: string,
  }): number {
    const {
      source,
    } = params;

    return SOURCE_PRIORITY[source] ?? 0;
  }

  private buildContractDedupeKey(params: {
    item: ProtocolsSourceContractT,
  }): string {
    const {
      item,
    } = params;

    return [
      item.protocolKey.toLowerCase(),
      this.extractContractChainDedupePart({
        item,
      }),
      item.address.toLowerCase(),
    ].join(':');
  }

  private extractContractChainDedupePart(params: {
    item: ProtocolsSourceContractT,
  }): string {
    const {
      item,
    } = params;

    if (typeof item.chainIdOrig === 'number') {
      return String(item.chainIdOrig);
    }

    if (item.chainId) {
      return String(item.chainId);
    }

    return 'unknown-chain';
  }
}
