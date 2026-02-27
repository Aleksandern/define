import {
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Timeout,
} from '@nestjs/schedule';

import axios from 'axios';
import type {
  AggregatePaginateModel,
  AnyBulkWriteOperation,
  Types,
} from 'mongoose';
import pLimit from 'p-limit';

import { ChainsRpcDisableReasonP } from '@define/common/types';
import {
  dateTimeUtils,
} from '@define/common/utils';

import { LoggerService } from '@appApi/services/logger.service';
import { dbUtils } from '@appApi/utils';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import {
  Chain,
  ChainDocument,
  ChainsRpc,
  ChainsRpcDocument,
} from '../schemas';

interface JsonRpcResp<T> { jsonrpc: '2.0'; id: number; result?: T; error?: any }

/**
 * TODO:
 *
 * - priority-based RPC sorting (primary → fallback → public)
 *
 * Idea: not all RPCs are equal.
 * primary: paid/private (Alchemy/Infura) — the most reliable
 * fallback: backup (a second provider or the best public one)
 * public: from chainid/chainlist — the most unstable
 *
 * When selecting an RPC for operation, you should use:
 * healthy primary
 * if none — healthy fallback
 * if none — public
 *
 * And within each group, sort by:
 * healthy=true
 * lower latencyMs
 * higher weight
 *
 * - Adaptive cooldown (exponential backoff)
 * 1st error → cooldown 30s
 * 2nd error → cooldown 2m
 * 3rd error → cooldown 10m
 * 4th error → cooldown 1h
 *
 * - RpcPool on top of Mongo
 */

@Injectable()
export class ChainsRpcsHealthCron {
  private readonly logger = new LoggerService(ChainsRpcsHealthCron.name);

  constructor(
    @InjectModel(Chain.name) private chainModel: AggregatePaginateModel<ChainDocument>,
    @InjectModel(ChainsRpc.name) private chainsRpcModel: AggregatePaginateModel<ChainsRpcDocument>,

    @Inject(forwardRef(() => RpcClientFactory))
    private readonly rpcClientFactory: RpcClientFactory,
  ) {}

  private async jsonRpc<T>({
    http,
    url,
    method,
    params = [],
  }: {
    http: ReturnType<typeof axios.create>,
    url: string,
    method: string,
    params?: any[],
  }): Promise<T> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params, // required by nodes even if it's empty
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

  private async invalidateChainsByRpcIds({
    rpcIds,
  }: {
    rpcIds: (string | Types.ObjectId)[],
  }) {
    if (!rpcIds.length) {
      return;
    }

    const rpcObjectIds = rpcIds.map((id) => dbUtils.idToObjectId(id));

    // 1) rpc -> chain ObjectId
    const rpcs = await this.chainsRpcModel
      .find({ _id: { $in: rpcObjectIds } })
      .select({ chainId: 1 })
      .lean();

    if (!rpcs.length) {
      return;
    }

    const chainIds = Array.from(new Set(rpcs.map((r) => r.chainId.toString())));

    // 2) chain ObjectId -> chainIdOrig
    const chains = await this.chainModel
      .find({ _id: { $in: chainIds.map((id) => dbUtils.idToObjectId(id)) } })
      .select({ chainIdOrig: 1 })
      .lean();

    // 3) invalidate per chainIdOrig
    chains.forEach((c) => {
      if (typeof c.chainIdOrig === 'number') {
        this.rpcClientFactory.invalidate({
          chainIdOrig: c.chainIdOrig,
        });
      }
    });
  }

  @Timeout(1000)
  async startup() {
    await this.runHealthCheck();
  }

  async runHealthCheck() {
    const dateNowLib = dateTimeUtils.getLib();
    const dateNow = dateNowLib.clone().toDate();
    const dateNowMs = dateNow.getTime();

    const rpcs = await this.chainsRpcModel
      .find({
        $or: [{ cooldownUntil: { $exists: false } }, { cooldownUntil: { $lte: dateNow } }],
      })
      .sort({
        isHealthy: 1,
        lastCheckedAt: 1,
      })
      .limit(200)
      .lean();

    if (rpcs.length === 0) {
      return;
    }

    // collect unique chain ObjectId
    const chainObjectIds = Array.from(new Set(rpcs.map((r) => String(r.chainId))));

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
        // eth_chainId (check if correct chainId)
        const chainIdHex = await this.jsonRpc<string>({
          http,
          url: rpcDoc.url,
          method: 'eth_chainId',
        });
        const gotChainId = parseInt(chainIdHex, 16);

        if (!Number.isFinite(gotChainId)) {
          throw new Error(`Invalid eth_chainId: ${chainIdHex}`);
        }
        if (gotChainId !== chainInfo.chainIdOrig) {
          throw new Error(`CHAIN_MISMATCH expected=${chainInfo.chainIdOrig} got=${gotChainId}`);
        }

        // eth_blockNumber (check if it is alive)
        await this.jsonRpc<string>({
          http,
          url: rpcDoc.url,
          method: 'eth_blockNumber',
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
    const limit = pLimit(concurrency);
    const promises = rpcs.map((rpc) => (
      limit(() => checkOne(rpc))
    ));
    const results = await Promise.all(promises);

    // 5) bulk update results
    const coolDownMs = 60_000;

    const ops = results.map<AnyBulkWriteOperation<ChainsRpcDocument>>((item) => {
      if (item.isSuccess) {
        return {
          updateOne: {
            filter: {
              _id: item.chainsRpcId,
            },
            update: {
              $set: {
                isHealthy: true,
                latencyMs: item.latencyMs,
                lastCheckedAt: dateNow,
                failCount: 0,
              },
              $unset: {
                cooldownUntil: '',
                lastError: '',
              },
            },
          },
        };
      }

      const isWrongChain = item.error.startsWith('CHAIN_MISMATCH');

      return {
        updateOne: {
          filter: {
            _id: item.chainsRpcId,
          },
          update: {
            $set: {
              isHealthy: false,
              isDisabled: isWrongChain,
              disabledReason: isWrongChain ? ChainsRpcDisableReasonP.wrongChain : undefined,
              lastCheckedAt: dateNow,
              lastError: item.error,
              cooldownUntil: new Date(dateNowMs + coolDownMs),
            },
            $inc: { failCount: 1 },
          },
        },
      };
    });

    await this.chainsRpcModel.bulkWrite(ops, { ordered: false });

    const ok = results.filter((r) => r.isSuccess).length;
    const bad = (results.length - ok);

    // invalidating only chains affected by this run
    await this.invalidateChainsByRpcIds({
      rpcIds: results.map((r) => r.chainsRpcId),
    });

    this.logger.log({
      message: 'RPC health-check done',
      data: {
        checked: results.length,
        ok,
        bad,
      },
    });
  }
}
