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

import {
  ProtocolsService,
} from './protocols.service';
import {
  ProtocolsContractsService,
} from './protocols-contracts.service';

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

    console.log('!!!', { payloads });

    const merged = this.mergePayloads({
      payloads,
    });

    const protocolIdByKey = await this.upsertProtocols({
      items: merged.protocols,
    });

    await this.upsertContracts({
      items: merged.contracts,
      protocolIdByKey,
    });

    return {
      protocolsUpserted: merged.protocols.length,
      contractsUpserted: merged.contracts.length,
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

    // eslint-disable-next-line no-restricted-syntax
    for (const payload of payloads) {
      // eslint-disable-next-line no-restricted-syntax
      for (const protocol of payload.protocols) {
        const key = protocol.key.toLowerCase();

        if (!protocolsMap.has(key)) {
          protocolsMap.set(key, {
            ...protocol,
            key,
          });
        }
      }

      // eslint-disable-next-line no-restricted-syntax
      for (const contract of payload.contracts) {
        const key = `${contract.chainIdOrig}:${contract.address.toLowerCase()}`;

        if (!contractsMap.has(key)) {
          contractsMap.set(key, {
            ...contract,
            protocolKey: contract.protocolKey.toLowerCase(),
            address: contract.address.toLowerCase(),
            role: contract.role?.toLowerCase(),
            implementationAddress: contract.implementationAddress?.toLowerCase(),
          });
        }
      }
    }

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
        item,
      });

      protocolIdByKey.set(saved.key, saved._id);
    }

    return protocolIdByKey;
  }

  private async upsertContracts(params: {
    items: ProtocolsSourceContractT[],
    protocolIdByKey: Map<string, Types.ObjectId>,
  }): Promise<void> {
    const {
      items,
      protocolIdByKey,
    } = params;

    const contractsToSave = items
      .map((item) => {
        const protocolId = protocolIdByKey.get(item.protocolKey.toLowerCase());

        if (!protocolId) {
          return null;
        }

        return {
          protocolId: protocolId.toString(),
          protocolKey: item.protocolKey.toLowerCase(),
          chainIdOrig: item.chainIdOrig,
          address: item.address.toLowerCase(),
          role: item.role?.toLowerCase(),
          isProxy: item.isProxy ?? false,
          implementationAddress: item.implementationAddress?.toLowerCase(),
          source: item.source,
          sourceRef: item.sourceRef,
          confidence: item.confidence ?? 100,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    await this.protocolsContractsService.bulkUpsert({
      items: contractsToSave,
    });
  }
}
