import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Cron,
  CronExpression,
  Timeout,
} from '@nestjs/schedule';

import axios from 'axios';
import type {
  AggregatePaginateModel,
  AnyBulkWriteOperation,
} from 'mongoose';

import {
  generalUtils,
} from '@define/common/utils';

import { LoggerService } from '@appApi/services/logger.service';

import {
  Chain,
  ChainDocument,
  ChainsRpc,
  ChainsRpcDocument,
} from '../schemas';

interface ChainidNetworkEntry {
  name?: string,
  chain?: string,
  chainId: number,
  networkId?: number,
  shortName?: string,
  infoURL?: string,
  rpc?: string[],
  faucets?: string[],
  nativeCurrency?: { name?: string; symbol?: string; decimals?: number },
  explorers?: { name?: string; url?: string; standard?: string }[],
}

interface DefiLlamaChainEntry {
  name?: string,
  chainId?: number,
}

@Injectable()
export class ChainsRpcsCron {
  private readonly logger = new LoggerService(ChainsRpcsCron.name);

  constructor(
    @InjectModel(Chain.name) private chainModel: AggregatePaginateModel<ChainDocument>,
    @InjectModel(ChainsRpc.name) private chainsRpcModel: AggregatePaginateModel<ChainsRpcDocument>,
  ) {}

  private normalizeChainToken({
    value,
  }: {
    value: string,
  }): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[()]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private buildBaseChainKeyCandidate({
    item,
  }: {
    item: ChainidNetworkEntry,
  }): string {
    const genericValues = new Set([
      'eth',
      'etc',
      'testnet',
      'mainnet',
    ]);

    const candidates = [
      item.shortName,
      item.chain,
      item.name,
    ]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .map((value) => this.normalizeChainToken({ value }))
      .filter(Boolean)
      .filter((value) => !genericValues.has(value));

    return candidates[0] || `chain-${item.chainId}`;
  }

  private resolveChainKey({
    chainIdOrig,
    item,
    existingKeyByChainId,
    existingChainIdByKey,
    batchReservedKeys,
  }: {
    chainIdOrig: number,
    item: ChainidNetworkEntry,
    existingKeyByChainId: Map<number, string>,
    existingChainIdByKey: Map<string, number>,
    batchReservedKeys: Set<string>,
  }): string {
    const canonicalMainnetKeys: Record<number, string> = {
      1: 'ethereum',
      10: 'optimism',
      56: 'bsc',
      100: 'gnosis',
      137: 'polygon',
      250: 'fantom',
      324: 'zksync',
      8453: 'base',
      42161: 'arbitrum',
      43114: 'avalanche',
      42220: 'celo',
      59144: 'linea',
      5000: 'mantle',
      534352: 'scroll',
      11155111: 'sepolia',
      17000: 'holesky',
    };

    /**
     * Если сеть уже есть в БД и у неё уже есть key,
     * сохраняем стабильность и повторно используем существующий key.
     */
    const existingKey = existingKeyByChainId.get(chainIdOrig);

    if (existingKey) {
      batchReservedKeys.add(existingKey);

      return existingKey;
    }

    /**
     * Для canonical chains используем заранее согласованный key.
     */
    const canonicalKey = canonicalMainnetKeys[chainIdOrig];

    if (canonicalKey) {
      const ownerChainId = existingChainIdByKey.get(canonicalKey);
      const isReservedInBatch = batchReservedKeys.has(canonicalKey);

      if (
        (ownerChainId === undefined || ownerChainId === chainIdOrig)
        && !isReservedInBatch
      ) {
        batchReservedKeys.add(canonicalKey);

        return canonicalKey;
      }

      const fallbackCanonicalKey = `${canonicalKey}-${chainIdOrig}`;

      batchReservedKeys.add(fallbackCanonicalKey);

      return fallbackCanonicalKey;
    }

    /**
     * Для остальных сетей:
     * 1. пытаемся дать красивый base key
     * 2. если конфликтует — добавляем chainIdOrig
     */
    const baseCandidate = this.buildBaseChainKeyCandidate({
      item,
    });

    const existingOwnerChainId = existingChainIdByKey.get(baseCandidate);
    const isReservedInBatch = batchReservedKeys.has(baseCandidate);

    if (
      (existingOwnerChainId === undefined || existingOwnerChainId === chainIdOrig)
      && !isReservedInBatch
    ) {
      batchReservedKeys.add(baseCandidate);

      return baseCandidate;
    }

    const fallbackKey = `${baseCandidate}-${chainIdOrig}`;

    batchReservedKeys.add(fallbackKey);

    return fallbackKey;
  }

  private buildSearchKeys({
    key,
    item,
    defillamaNames,
  }: {
    key: string,
    item: ChainidNetworkEntry,
    defillamaNames: string[],
  }): string[] {
    const extraByKey: Record<string, string[]> = {
      ethereum: ['eth', 'mainnet', 'ethereum-mainnet'],
      optimism: ['op'],
      bsc: ['binance', 'bnb-smart-chain', 'binance-smart-chain'],
      polygon: ['matic', 'polygon-mainnet'],
      arbitrum: ['arb', 'arbitrum-one'],
      avalanche: ['avax'],
      zksync: ['zksync-era'],
      gnosis: ['xdai', 'gnosis-chain'],
      sepolia: ['ethereum-sepolia'],
      holesky: ['ethereum-holesky'],
    };

    const genericShortNames = new Set([
      'eth',
    ]);

    const normalizedShortName = item.shortName
      ? this.normalizeChainToken({ value: item.shortName })
      : '';

    const shortNameForSearch = (
      normalizedShortName
      && !genericShortNames.has(normalizedShortName)
    )
      ? item.shortName
      : undefined;

    const set = new Set<string>();

    [
      key,
      item.name,
      shortNameForSearch,
      item.chain,
      ...defillamaNames,
      ...(extraByKey[key] ?? []),
    ]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .map((value) => this.normalizeChainToken({ value }))
      .filter(Boolean)
      .forEach((value) => set.add(value));

    return [...set];
  }

  private buildDefiLlamaNamesByChainId({
    items,
  }: {
    items: DefiLlamaChainEntry[],
  }): Map<number, string[]> {
    const map = new Map<number, string[]>();

    items.forEach((item) => {
      if (!item.chainId || !item.name) {
        return;
      }

      const current = map.get(item.chainId) ?? [];

      current.push(item.name);

      map.set(item.chainId, current);
    });

    return map;
  }

  @Timeout(1000)
  async startup() {
    // await this.fetchChain();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchChain() {
    const urlDefillama = 'https://api.llama.fi/chains';
    const urlChainid = 'https://chainid.network/chains.json';

    const [resChainid, resDefillama] = await Promise.all([
      axios.get<ChainidNetworkEntry[]>(urlChainid, {
        timeout: 20_000,
        headers: { accept: 'application/json' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }),
      axios.get<DefiLlamaChainEntry[]>(urlDefillama, {
        timeout: 20_000,
        headers: { accept: 'application/json' },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }),
    ]);

    if (!Array.isArray(resChainid.data)) {
      this.logger.error({
        message: 'Invalid resChainid response data',
        stack: new Error().stack,
      });

      return;
    }

    if (!Array.isArray(resDefillama.data)) {
      this.logger.error({
        message: 'Invalid resDefillama response data',
        stack: new Error().stack,
      });

      return;
    }

    const defillamaNamesByChainId = this.buildDefiLlamaNamesByChainId({
      items: resDefillama.data,
    });

    /**
     * Берём существующие chains заранее, чтобы:
     * 1. сохранять уже назначенные key
     * 2. детектить конфликты key до bulkWrite
     */
    const chainsDbShort = await this.chainModel.find({}, {
      chainIdOrig: 1,
      key: 1,
    }).lean();

    const existingKeyByChainId = new Map<number, string>(
      chainsDbShort
        .filter((item) => (
          typeof item.chainIdOrig === 'number'
          && typeof item.key === 'string'
          && item.key.length > 0
        ))
        .map((item) => [item.chainIdOrig, item.key]),
    );

    const existingChainIdByKey = new Map<string, number>(
      chainsDbShort
        .filter((item) => (
          typeof item.chainIdOrig === 'number'
          && typeof item.key === 'string'
          && item.key.length > 0
        ))
        .map((item) => [item.key, item.chainIdOrig]),
    );

    const batchReservedKeys = new Set<string>();

    // chains START
    const chainOps: AnyBulkWriteOperation<ChainDocument>[] = [];

    resChainid.data.forEach((item, _index) => {
      const hasChainId = (typeof item.chainId === 'number');

      if (!hasChainId) {
        return;
      }

      const key = this.resolveChainKey({
        chainIdOrig: item.chainId,
        item,
        existingKeyByChainId,
        existingChainIdByKey,
        batchReservedKeys,
      });

      const searchKeys = this.buildSearchKeys({
        key,
        item,
        defillamaNames: defillamaNamesByChainId.get(item.chainId) ?? [],
      });

      chainOps.push({
        updateOne: {
          filter: { chainIdOrig: item.chainId },
          update: [
            {
              $set: {
                chainIdOrig: {
                  $ifNull: [
                    '$chainIdOrig',
                    item.chainId,
                  ],
                },
                key,
                searchKeys,
                name: {
                  $cond: [
                    {
                      $eq: [
                        { $ifNull: ['$name', ''] },
                        '',
                      ],
                    },
                    item.name ?? '',
                    '$name',
                  ],
                },
                nameShort: {
                  $cond: [
                    {
                      $eq: [
                        { $ifNull: ['$nameShort', ''] },
                        '',
                      ],
                    },
                    item.shortName ?? '',
                    '$nameShort',
                  ],
                },
                infoUrl: {
                  $cond: [
                    {
                      $eq: [
                        { $ifNull: ['$infoUrl', ''] },
                        '',
                      ],
                    },
                    item.infoURL ?? '',
                    '$infoUrl',
                  ],
                },
                nativeCurrency: {
                  $cond: [
                    {
                      $or: [
                        {
                          $eq: [
                            { $ifNull: ['$nativeCurrency.name', ''] },
                            '',
                          ],
                        },
                        {
                          $eq: [
                            { $ifNull: ['$nativeCurrency.symbol', ''] },
                            '',
                          ],
                        },
                        {
                          $eq: [
                            { $ifNull: ['$nativeCurrency.decimals', null] },
                            null,
                          ],
                        },
                      ],
                    },
                    {
                      name: item.nativeCurrency?.name ?? '',
                      symbol: item.nativeCurrency?.symbol ?? '',
                      decimals: item.nativeCurrency?.decimals ?? 0,
                    },
                    '$nativeCurrency',
                  ],
                },
              },
            },
          ],
          upsert: true,
        },
      });
    });

    if (chainOps.length > 0) {
      await this.chainModel.bulkWrite(chainOps);
    }
    // chains END

    const chainsDb = await this.chainModel.find().lean();
    const chainsDbByChainIdOrig = new Map(
      chainsDb.map((item) => [item.chainIdOrig, item]),
    );

    // chain rpc START
    const seen = new Set<string>();
    const rpcOps: AnyBulkWriteOperation<ChainsRpcDocument>[] = [];

    resChainid.data.forEach((item, _index) => {
      const hasChainId = (typeof item.chainId === 'number');

      if (!hasChainId) {
        return;
      }

      const chainInfoDb = chainsDbByChainIdOrig.get(item.chainId);

      if (!chainInfoDb) {
        return;
      }

      const urls = (item.rpc ?? [])
        .filter((u) => generalUtils.isUrl(u))
        .map((u) => generalUtils.normalizeUrl(u))
        .filter((u) => (
          generalUtils.isUrl(u)
          && generalUtils.isHttpRpc(u)
        ));

      urls.forEach((itemTmp) => {
        const urlTmp = itemTmp.toLowerCase();
        const key = `${item.chainId}|${urlTmp}`;

        if (seen.has(key)) {
          return;
        }

        seen.add(key);

        rpcOps.push({
          updateOne: {
            filter: {
              chainId: chainInfoDb._id,
              url: urlTmp,
            },
            update: {
              $set: {
                chainId: chainInfoDb._id,
                url: urlTmp,
              },
            },
            upsert: true,
          },
        });
      });
    });

    if (rpcOps.length > 0) {
      await this.chainsRpcModel.bulkWrite(rpcOps);
    }
    // chain rpc END
  }
}
