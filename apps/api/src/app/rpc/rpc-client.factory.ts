import { Injectable } from '@nestjs/common';

import { createHash } from 'node:crypto';
import {
  createPublicClient,
  defineChain,
  fallback,
  http,
  type PublicClient,
} from 'viem';

import { ChainsService } from '../chains/services/chains.service';
import { ChainsRpcsService } from '../chains/services/chains-rpcs.service';

interface CacheEntry {
  client: PublicClient,
  expiresAt: number,
  urlsHash: string,
}

@Injectable()
export class RpcClientFactory {
  private cache = new Map<number, CacheEntry>();

  private readonly ttlMs = 60_000;

  private readonly rpcLimit = 5;

  private readonly timeoutMs = 10_000;

  constructor(
    private readonly chainsRpcsService: ChainsRpcsService,
    private readonly chainsService: ChainsService,
  ) {}

  private rpcUrlsHash({
    urls,
  }: {
    urls: string[],
  }): string {
    const normalized = urls.map((u) => u.trim().toLowerCase()).sort();
    const res = createHash('sha256').update(normalized.join('|')).digest('hex').slice(0, 16);

    return res;
  }

  async getClient({
    chainIdOrig,
  }:{
    chainIdOrig: number,
  }): Promise<PublicClient> {
    const now = Date.now();

    // get chain from DB
    const chainDb = await this.chainsService.getEnabledChain({
      chainIdOrig,
    });

    if (!chainDb) {
      throw new Error(`Chain ${chainIdOrig} not found in DB`);
    }

    // get RPCs
    const rpcs = await this.chainsRpcsService.getBestRpcs({
      chainId: chainDb._id,
      limit: this.rpcLimit,
    });

    if (!rpcs.length) {
      throw new Error(`No RPCs found for chainIdOrig=${chainIdOrig}`);
    }

    const urls = rpcs.map((r) => r.url);
    const urlsHash = this.rpcUrlsHash({ urls });

    const cached = this.cache.get(chainIdOrig);
    if (
      cached
      && (cached.expiresAt > now)
      && (cached.urlsHash === urlsHash)
    ) {
      return cached.client;
    }

    // validate nativeCurrency
    const {
      symbol,
      decimals,
      name,
    } = chainDb.nativeCurrency;

    if (
      !symbol
      || (typeof decimals !== 'number')
    ) {
      throw new Error(
        `Invalid nativeCurrency for chainIdOrig=${chainIdOrig}`,
      );
    }

    if (
      !Number.isInteger(decimals)
      || decimals < 0
      || decimals > 255
    ) {
      throw new Error(
        `Invalid decimals in nativeCurrency for chainIdOrig=${chainIdOrig}`,
      );
    }

    // dynamically create chain for viem
    const chain = defineChain({
      id: chainIdOrig,
      name: chainDb.name ?? `Chain ${chainIdOrig}`,
      network: String(chainIdOrig),
      nativeCurrency: {
        name: name ?? symbol,
        symbol,
        decimals,
      },
      rpcUrls: {
        default: { http: urls },
      },
    });

    // 5️⃣ transport с fallback
    const transport = fallback(
      urls.map((url) => http(url, {
        timeout: this.timeoutMs,
        batch: true,
      })),
    );

    const client = createPublicClient({
      chain,
      transport,
    });

    this.cache.set(chainIdOrig, {
      client,
      expiresAt: now + this.ttlMs,
      urlsHash,
    });

    return client;
  }

  invalidate({
    chainIdOrig,
  }: {
    chainIdOrig?: number,
  }) {
    if (chainIdOrig === undefined) {
      this.cache.clear();
    } else {
      this.cache.delete(chainIdOrig);
    }
  }
}
