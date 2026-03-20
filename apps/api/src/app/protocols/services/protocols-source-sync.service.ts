import {
  Injectable,
} from '@nestjs/common';

import type {
  Types,
} from 'mongoose';

import {
  ProtocolsSourceDefiLlamaProvider,
} from '../providers';
import type {
  ProtocolsSourceContractT,
  ProtocolsSourcePayloadT,
  ProtocolsSourceProtocolT,
  ProtocolsSourceProviderT,
} from '../types/protocols-source.types';

import { ProtocolsService } from './protocols.service';
import { ProtocolsContractsService } from './protocols-contracts.service';

@Injectable()
export class ProtocolsSourceSyncService {
  private readonly providers: ProtocolsSourceProviderT[];

  constructor(
    private readonly protocolsService: ProtocolsService,
    private readonly protocolsContractsService: ProtocolsContractsService,
    private readonly protocolsSourceDefiLlamaProvider: ProtocolsSourceDefiLlamaProvider,
  ) {
    this.providers = [
      this.protocolsSourceDefiLlamaProvider,
    ];
  }

  async syncAll(params?: {
    limitProtocols?: number,
  }): Promise<{
    protocolsUpserted: number,
    contractsUpserted: number,
  }> {
    const payloads = await Promise.all(
      this.providers.map((provider) => provider.load({
        limitProtocols: params?.limitProtocols ?? 200,
      })),
    );

    const merged = this.mergePayloads({
      payloads,
    });

    const protocolIdByKey = await this.upsertProtocols({
      items: merged.protocols,
    });

    const contractsToSave = this.buildContractsToSave({
      items: merged.contracts,
      protocolIdByKey,
    });

    await this.protocolsContractsService.bulkUpsert({
      items: contractsToSave,
    });

    return {
      protocolsUpserted: merged.protocols.length,
      contractsUpserted: contractsToSave.length,
    };
  }

  private mergePayloads(params: {
    payloads: ProtocolsSourcePayloadT[],
  }): ProtocolsSourcePayloadT {
    const {
      payloads,
    } = params;

    const protocolsMap = new Map<string, ProtocolsSourceProtocolT>();
    const contractsMap = new Map<string, ProtocolsSourceContractT>();

    payloads.forEach((payload) => {
      payload.protocols.forEach((protocol) => {
        const protocolKey = protocol.key.toLowerCase();

        if (!protocolsMap.has(protocolKey)) {
          protocolsMap.set(protocolKey, {
            ...protocol,
            key: protocolKey,
          });
        }
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

        const existing = contractsMap.get(dedupeKey);

        if (!existing) {
          return;
        }

        contractsMap.set(dedupeKey, this.mergeContracts({
          current: existing,
          next: contract,
        }));
      });
    });

    return {
      protocols: [...protocolsMap.values()],
      contracts: [...contractsMap.values()],
    };
  }

  private async upsertProtocols(params: {
    items: ProtocolsSourceProtocolT[],
  }): Promise<Map<string, Types.ObjectId>> {
    const {
      items,
    } = params;

    const protocolIdByKey = new Map<string, Types.ObjectId>();

    // eslint-disable-next-line no-restricted-syntax
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop
      const saved = await this.protocolsService.upsertOne({
        item: {
          ...item,
          key: item.key.toLowerCase(),
        },
      });

      protocolIdByKey.set(saved.key, saved._id);
    }

    return protocolIdByKey;
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

    /**
     * Simple strategy:
     * - keep the record with higher confidence
     * - if confidence is the same, prefer current
     */
    const currentConfidence = currentNorm.confidence ?? 0;
    const nextConfidence = nextNorm.confidence ?? 0;

    if (nextConfidence > currentConfidence) {
      return nextNorm;
    }

    return currentNorm;
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
