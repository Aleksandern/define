import {
  Injectable,
} from '@nestjs/common';

import axios from 'axios';
import pLimit from 'p-limit';

import {
  ProtocolSourceP,
} from '@define/common/types';

import { dbUtils } from '@appApi/utils';

import { ChainsService } from '@appApi/app/chains/services';

import type {
  ProtocolsSourceContractT,
  ProtocolsSourcePayloadT,
  ProtocolsSourceProtocolT,
  ProtocolsSourceProviderT,
} from '../types/protocols-source.types';

interface DefiLlamaProtocolApiItemT {
  name?: string,
  slug?: string,
  url?: string,
  category?: string,
}

interface GithubContentItemT {
  name: string,
  path: string,
  type: 'file' | 'dir',
  download_url?: string | null,
  html_url: string,
  url?: string,
}

interface ResolvedChainT {
  idChain: string,
  chainIdOrig: number,
}

@Injectable()
export class ProtocolsSourceDefiLlamaProvider implements ProtocolsSourceProviderT {
  readonly source = ProtocolSourceP.defillama;

  private readonly llamaProtocolsUrl = 'https://api.llama.fi/protocols';

  private readonly githubProjectsApiBase = 'https://api.github.com/repos/DefiLlama/DefiLlama-Adapters/contents/projects';

  private readonly githubHeaders = {
    Accept: 'application/vnd.github+json',
  };

  private readonly protocolsConcurrency = 5;

  private readonly filesConcurrency = 6;

  private readonly githubTreeConcurrency = 6;

  private readonly chainResolveConcurrency = 10;

  constructor(
    private readonly chainsService: ChainsService,
  ) {}

  async load(params?: {
    limitProtocols?: number,
  }): Promise<ProtocolsSourcePayloadT> {
    const protocols = await this.loadProtocols({
      limit: params?.limitProtocols,
    });

    const protocolLimit = pLimit(this.protocolsConcurrency);

    const contractsChunks = await Promise.all(
      protocols.map((protocol) => protocolLimit(() => this.loadContractsForProtocol({
        protocolKey: protocol.key,
        slug: protocol.slug ?? protocol.key,
      }))),
    );

    return {
      protocols,
      contracts: this.dedupeContracts({
        items: contractsChunks.flat(),
      }),
    };
  }

  private async loadProtocols(params?: {
    limit?: number,
  }): Promise<ProtocolsSourceProtocolT[]> {
    const limit = params?.limit;

    const res = await axios.get<DefiLlamaProtocolApiItemT[]>(
      this.llamaProtocolsUrl,
      {
        timeout: 30_000,
      },
    );

    const items = res.data
      .filter((item) => item.slug && item.name)
      .map((item) => ({
        key: String(item.slug).toLowerCase(),
        slug: item.slug,
        name: item.name ?? item.slug ?? 'unknown',
        family: item.category?.toLowerCase(),
        website: item.url,
        source: ProtocolSourceP.defillama,
        source_ref: this.llamaProtocolsUrl,
        isDisabled: false,
      }));

    if (typeof limit === 'number' && limit > 0) {
      return items.slice(0, limit);
    }

    return items;
  }

  private async loadContractsForProtocol(params: {
    protocolKey: string,
    slug: string,
  }): Promise<ProtocolsSourceContractT[]> {
    const {
      protocolKey,
      slug,
    } = params;

    const files = await this.fetchAdapterFilesRecursive({
      slug,
    });

    if (files.length === 0) {
      return [];
    }

    const fileLimit = pLimit(this.filesConcurrency);

    const contractsChunks = await Promise.all(
      files.map((file) => fileLimit(async () => {
        const content = await this.fetchFileContent({
          downloadUrl: file.download_url ?? '',
        });

        return this.extractContractsFromAdapter({
          protocolKey,
          sourceRef: file.html_url,
          content,
        });
      })),
    );

    return contractsChunks.flat();
  }

  private async fetchAdapterFilesRecursive(params: {
    slug: string,
  }): Promise<GithubContentItemT[]> {
    const {
      slug,
    } = params;

    const rootUrl = `${this.githubProjectsApiBase}/${slug}`;
    const seenDirs = new Set<string>();
    const out: GithubContentItemT[] = [];

    await this.walkGithubDir({
      url: rootUrl,
      seenDirs,
      out,
    });

    return out;
  }

  private async walkGithubDir(params: {
    url: string,
    seenDirs: Set<string>,
    out: GithubContentItemT[],
  }): Promise<void> {
    const {
      url,
      seenDirs,
      out,
    } = params;

    if (seenDirs.has(url)) {
      return;
    }

    seenDirs.add(url);

    try {
      const res = await axios.get<GithubContentItemT[]>(url, {
        timeout: 30_000,
        headers: this.githubHeaders,
      });

      const items = Array.isArray(res.data) ? res.data : [];
      const dirLimit = pLimit(this.githubTreeConcurrency);

      await Promise.all(
        items.map((item) => dirLimit(async () => {
          if (item.type === 'dir' && item.url) {
            await this.walkGithubDir({
              url: item.url,
              seenDirs,
              out,
            });

            return;
          }

          if (
            item.type === 'file'
            && item.download_url
            && (
              item.name.endsWith('.ts')
              || item.name.endsWith('.js')
            )
          ) {
            out.push(item);
          }
        })),
      );
    } catch {
      //
    }
  }

  private async fetchFileContent(params: {
    downloadUrl: string,
  }): Promise<string> {
    const {
      downloadUrl,
    } = params;

    if (!downloadUrl) {
      return '';
    }

    const res = await axios.get<string>(downloadUrl, {
      timeout: 30_000,
      responseType: 'text',
    });

    return res.data;
  }

  private async extractContractsFromAdapter(params: {
    protocolKey: string,
    sourceRef: string,
    content: string,
  }): Promise<ProtocolsSourceContractT[]> {
    const {
      protocolKey,
      sourceRef,
      content,
    } = params;

    if (!content.trim()) {
      return [];
    }

    const blocks = this.extractChainBlocksBalanced({
      content,
    });

    const resolveLimit = pLimit(this.chainResolveConcurrency);

    const chunks = await Promise.all(
      blocks.map((block) => resolveLimit(async () => {
        const chain = await this.resolveChain({
          rawChainName: block.chainName,
        });

        if (!chain) {
          return [] as ProtocolsSourceContractT[];
        }

        const addresses = this.extractAddresses({
          content: block.block,
        });

        if (addresses.length === 0) {
          return [] as ProtocolsSourceContractT[];
        }

        return addresses.map((address): ProtocolsSourceContractT => ({
          protocolKey,
          chainId: dbUtils.idToObjectId(chain.idChain),
          chainIdOrig: chain.chainIdOrig,
          address,
          role: this.inferRoleFromBlock({
            block: block.block,
          }),
          source: ProtocolSourceP.defillama,
          sourceRef,
          confidence: 70,
        }));
      })),
    );

    const fromBlocks = chunks.flat();

    if (fromBlocks.length > 0) {
      return fromBlocks;
    }

    const resolvedChains = await this.resolveUniqueChainsFromContent({
      content,
    });

    if (resolvedChains.length === 1) {
      const chain = resolvedChains[0];
      const addresses = this.extractAddresses({
        content,
      });

      if (addresses.length === 0) {
        return [];
      }

      return addresses.map((address): ProtocolsSourceContractT => ({
        protocolKey,
        chainId: dbUtils.idToObjectId(chain.idChain),
        chainIdOrig: chain.chainIdOrig,
        address,
        source: ProtocolSourceP.defillama,
        sourceRef,
        confidence: 40,
      }));
    }

    return [];
  }

  private extractChainBlocksBalanced(params: {
    content: string,
  }): {
    chainName: string,
    block: string,
  }[] {
    const {
      content,
    } = params;

    const out: {
      chainName: string,
      block: string,
    }[] = [];

    const headerRegex = /([a-zA-Z0-9_-]+)\s*:\s*\{/g;
    let match: RegExpExecArray | null = headerRegex.exec(content);

    while (match !== null) {
      const chainName = match[1]?.trim().toLowerCase();
      const openBraceIndex = headerRegex.lastIndex - 1;

      if (chainName) {
        const block = this.readBalancedObject({
          content,
          openBraceIndex,
        });

        if (block) {
          out.push({
            chainName,
            block,
          });
        }
      }

      match = headerRegex.exec(content);
    }

    return out;
  }

  private readBalancedObject(params: {
    content: string,
    openBraceIndex: number,
  }): string | null {
    const {
      content,
      openBraceIndex,
    } = params;

    if (content[openBraceIndex] !== '{') {
      return null;
    }

    let depth = 0;
    let index = openBraceIndex;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let prevChar = '';

    while (index < content.length) {
      const char = content[index];

      if (char === '\'' && !inDoubleQuote && !inTemplate && prevChar !== '\\') {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inTemplate && prevChar !== '\\') {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote && prevChar !== '\\') {
        inTemplate = !inTemplate;
      } else if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
        if (char === '{') {
          depth += 1;
        } else if (char === '}') {
          depth -= 1;

          if (depth === 0) {
            return content.slice(openBraceIndex + 1, index);
          }
        }
      }

      prevChar = char;
      index += 1;
    }

    return null;
  }

  private extractAddresses(params: {
    content: string,
  }): string[] {
    const {
      content,
    } = params;

    const matches = content.match(/0x[a-fA-F0-9]{40}/g) ?? [];

    return [...new Set(matches.map((value) => value.toLowerCase()))];
  }

  private inferRoleFromBlock(params: {
    block: string,
  }): string | undefined {
    const {
      block,
    } = params;

    const value = block.toLowerCase();

    if (value.includes('router')) return 'router';
    if (value.includes('factory')) return 'factory';
    if (value.includes('pool')) return 'pool';
    if (value.includes('vault')) return 'vault';
    if (value.includes('oracle')) return 'oracle';
    if (value.includes('gauge')) return 'gauge';
    if (value.includes('controller')) return 'controller';
    if (value.includes('market')) return 'market';

    return undefined;
  }

  private async resolveChain(params: {
    rawChainName: string,
  }): Promise<ResolvedChainT | null> {
    const {
      rawChainName,
    } = params;

    const candidates = this.buildChainSearchCandidates({
      rawChainName,
    });

    let index = 0;

    while (index < candidates.length) {
      // eslint-disable-next-line no-await-in-loop
      const chain = await this.chainsService.findOneBySearchKey({
        searchKey: candidates[index],
      });

      if (chain) {
        return {
          idChain: String(chain._id),
          chainIdOrig: chain.chainIdOrig,
        };
      }

      index += 1;
    }

    return null;
  }

  private buildChainSearchCandidates(params: {
    rawChainName: string,
  }): string[] {
    const {
      rawChainName,
    } = params;

    const normalized = rawChainName.trim().toLowerCase();

    const aliasMap: Record<string, string[]> = {
      eth: ['ethereum'],
      ethereum: ['ethereum'],
      arb: ['arbitrum'],
      arbitrum: ['arbitrum'],
      op: ['optimism'],
      optimism: ['optimism'],
      matic: ['polygon'],
      polygon: ['polygon'],
      avax: ['avalanche'],
      avalanche: ['avalanche'],
      bsc: ['bsc'],
      binance: ['bsc'],
      xdai: ['gnosis'],
      gnosis: ['gnosis'],
      era: ['zksync'],
      zksync: ['zksync'],
      'zksync-era': ['zksync'],
    };

    const out = new Set<string>();
    out.add(normalized);

    (aliasMap[normalized] ?? []).forEach((item) => out.add(item));

    return [...out];
  }

  private async resolveUniqueChainsFromContent(params: {
    content: string,
  }): Promise<ResolvedChainT[]> {
    const {
      content,
    } = params;

    const knownTokens = [
      'ethereum',
      'eth',
      'arbitrum',
      'arb',
      'optimism',
      'op',
      'polygon',
      'matic',
      'avalanche',
      'avax',
      'bsc',
      'binance',
      'gnosis',
      'xdai',
      'zksync',
      'zksync-era',
      'era',
      'base',
      'linea',
      'scroll',
      'mantle',
      'fantom',
      'celo',
      'sepolia',
      'holesky',
    ];

    const foundTokens = knownTokens.filter((token) => (
      new RegExp(`\\b${token}\\b`, 'i').test(content)
    ));

    const uniqueChains = new Map<string, ResolvedChainT>();

    let index = 0;

    while (index < foundTokens.length) {
      // eslint-disable-next-line no-await-in-loop
      const chain = await this.resolveChain({
        rawChainName: foundTokens[index],
      });

      if (chain) {
        uniqueChains.set(`${chain.idChain}:${chain.chainIdOrig}`, chain);
      }

      index += 1;
    }

    return [...uniqueChains.values()];
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

        return;
      }

      const existing = map.get(dedupeKey);

      if (!existing) {
        return;
      }

      const existingConfidence = existing.confidence ?? 0;
      const nextConfidence = normalized.confidence ?? 0;

      if (nextConfidence > existingConfidence) {
        map.set(dedupeKey, normalized);
      }
    });

    return [...map.values()];
  }
}
