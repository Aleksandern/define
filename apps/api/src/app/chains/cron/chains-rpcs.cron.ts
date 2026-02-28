import {
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Cron,
  CronExpression,
  // Timeout,
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

@Injectable()
export class ChainsRpcsCron {
  private readonly logger = new LoggerService(ChainsRpcsCron.name);

  constructor(
    @InjectModel(Chain.name) private chainModel: AggregatePaginateModel<ChainDocument>,
    @InjectModel(ChainsRpc.name) private chainsRpcModel: AggregatePaginateModel<ChainsRpcDocument>,
  ) {}

  // @Timeout(1000)
  async startup() {
    await this.fetchChain();
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchChain() {
    const url = 'https://chainid.network/chains.json';

    const res = await axios.get<ChainidNetworkEntry[]>(url, {
      timeout: 20_000,
      headers: { accept: 'application/json' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    if (!Array.isArray(res.data)) {
      this.logger.error({
        message: 'Invalid response data',
        stack: new Error().stack,
      });

      return;
    }

    // chains START
    const chainOps: AnyBulkWriteOperation<ChainDocument>[] = [];

    res.data.forEach((item, _index) => {
      const hasChainId = (typeof item.chainId === 'number');

      if (!hasChainId) {
        return;
      }

      // if (
      //   (index >= 3)
      //   && (item.chainId !== 137)
      // ) {
      //   return;
      // }

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

    // chain rpc START
    const seen = new Set<string>();
    const rpcOps: AnyBulkWriteOperation<ChainsRpcDocument>[] = [];

    res.data.forEach((item, _index) => {
      const hasChainId = (typeof item.chainId === 'number');

      if (!hasChainId) {
        return;
      }

      const chainInfoDb = chainsDb.find((c) => c.chainIdOrig === item.chainId);

      if (!chainInfoDb) {
        return;
      }

      // if (
      //   (index >= 3)
      //   && (item.chainId !== 137)
      // ) {
      //   return;
      // }

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
