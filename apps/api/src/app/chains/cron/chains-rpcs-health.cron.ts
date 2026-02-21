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
  dateTimeUtils,
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

interface JsonRpcResp<T> { jsonrpc: '2.0'; id: number; result?: T; error?: any }

@Injectable()
export class ChainsRpcsHealthCron {
  private readonly logger = new LoggerService(ChainsRpcsHealthCron.name);

  constructor(
    @InjectModel(Chain.name) private chainModel: AggregatePaginateModel<ChainDocument>,
    @InjectModel(ChainsRpc.name) private chainsRpcModel: AggregatePaginateModel<ChainsRpcDocument>,
  ) {}

  private async jsonRpc<T>({
    http,
    url,
    method,
    params,
  }: {
    http: ReturnType<typeof axios.create>,
    url: string,
    method: string,
    params: any[],
  }): Promise<T> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    };

    const res = await http.post<JsonRpcResp<T>>(url, payload);

    if (res.data?.error) {
      throw new Error(`RPC error: ${JSON.stringify(res.data.error)}`);
    }

    if (res.data?.result === undefined) {
      throw new Error(`RPC invalid response for ${method}`);
    }

    return res.data.result as T;
  }

  @Timeout(1000)
  async startup() {
    await this.runHealthCheck();
  }

  async runHealthCheck() {
    console.log('!!!health check', { });

    const dateNow = dateTimeUtils.getLib().toDate();

    const rpcs = await this.chainsRpcModel
      .find({
        $or: [{ cooldownUntil: { $exists: false } }, { cooldownUntil: { $lte: dateNow } }],
      })
      .limit(200)
      .lean();

    console.log('!!!', { rpcs });

    if (rpcs.length === 0) {
      return;
    }

    // collect unique chain ObjectId
    const chainObjectIds = Array.from(new Set(rpcs.map((r) => String(r.chainId))));
    console.log('[ !!!chainObjectIds ]', chainObjectIds);

    const chainsInfo = await this.chainModel
      .find({ _id: { $in: chainObjectIds } })
      .select({
        chainIdOrig: 1,
        name: 1,
      })
      .lean();

    const chainById = new Map<string, { chainIdOrig: number; name?: string }>();

    chainsInfo.forEach((c) => {
      chainById.set(String(c._id), {
        chainIdOrig: c.chainIdOrig,
        name: c.name,
      });
    });

    console.log('!!!', { chainsInfo });

    // axios instance
    const http = axios.create({
      timeout: 6000,
      headers: { 'content-type': 'application/json' },
    });

    // 3) check one RPC
    const checkOne = async (rpcDoc: typeof rpcs[number]) => {
      const chainInfo = chainById.get(String(rpcDoc.chainId));
      const resTmp = {
        chainsRpcId: rpcDoc._id,
        latencyMs: 0,
        isSuccess: false,
        error: '',
      };

      if (!chainInfo?.chainIdOrig) {
        resTmp.error = 'Chain not found for rpc.chainId';

        return resTmp;
      }

      const start = Date.now();

      try {
        // eth_chainId
        const chainIdHex = await this.jsonRpc<string>({
          http,
          url: rpcDoc.url,
          method: 'eth_chainId',
          params: [],
        });
        const gotChainId = parseInt(chainIdHex, 16);

        if (!Number.isFinite(gotChainId)) {
          throw new Error(`Invalid eth_chainId: ${chainIdHex}`);
        }
        if (gotChainId !== chainInfo.chainIdOrig) {
          throw new Error(`ChainId mismatch expected=${chainInfo.chainIdOrig} got=${gotChainId}`);
        }

        // eth_blockNumber (is it alive)
        await this.jsonRpc<string>({
          http,
          url: rpcDoc.url,
          method: 'eth_blockNumber',
          params: [],
        });

        const latencyMs = Date.now() - start;

        resTmp.isSuccess = true;
        resTmp.latencyMs = latencyMs;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);

        resTmp.error = msg;
      }

      return resTmp;
    };

    // 4) limit concurrency
    const concurrency = 10;
    const results: any[] = [];

    for (let i = 0; i < rpcs.length; i += concurrency) {
      const chunk = rpcs.slice(i, i + concurrency);
      // eslint-disable-next-line no-await-in-loop
      const out = await Promise.all(chunk.map(checkOne));
      results.push(...out);
    }

    console.log('!!!', { results });
  }
}
