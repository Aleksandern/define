import {
  Injectable,
} from '@nestjs/common';

import axios from 'axios';

import {
  ProtocolSourceP,
} from '@define/common/types';

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
}

@Injectable()
export class ProtocolsSourceDefiLlamaProvider implements ProtocolsSourceProviderT {
  readonly source = ProtocolSourceP.defillama;

  private readonly llamaProtocolsUrl = 'https://api.llama.fi/protocols';

  private readonly githubProjectsApiBase = 'https://api.github.com/repos/DefiLlama/DefiLlama-Adapters/contents/projects';

  private readonly githubHeaders = {
    Accept: 'application/vnd.github+json',
  };

  private readonly chainNameToId: Record<string, number> = {
    ethereum: 1,
    optimism: 10,
    bsc: 56,
    binance: 56,
    gnosis: 100,
    polygon: 137,
    fantom: 250,
    zksync: 324,
    base: 8453,
    arbitrum: 42161,
    avalanche: 43114,
    celo: 42220,
    linea: 59144,
    mantle: 5000,
    scroll: 534352,
  };

  async load(params?: {
    limitProtocols?: number,
  }): Promise<ProtocolsSourcePayloadT> {
    const protocols = await this.loadProtocols({
      limit: params?.limitProtocols ?? 200,
    });

    const contracts: ProtocolsSourceContractT[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const protocol of protocols) {
      const slug = protocol.slug ?? protocol.key;

      // eslint-disable-next-line no-await-in-loop
      const protocolContracts = await this.loadContractsForProtocol({
        protocolKey: protocol.key,
        slug,
      });

      contracts.push(...protocolContracts);
    }

    return {
      protocols,
      contracts: this.dedupeContracts({
        items: contracts,
      }),
    };
  }

  private async loadProtocols(params?: {
    limit?: number,
  }): Promise<ProtocolsSourceProtocolT[]> {
    const limit = params?.limit ?? 200;

    const res = await axios.get<DefiLlamaProtocolApiItemT[]>(
      this.llamaProtocolsUrl,
      {
        timeout: 30_000,
      },
    );

    return res.data
      .filter((item) => item.slug && item.name)
      .slice(0, limit)
      .map((item) => ({
        key: String(item.slug).toLowerCase(),
        slug: item.slug,
        name: item.name!,
        family: item.category?.toLowerCase(),
        website: item.url,
        source: ProtocolSourceP.defillama,
        source_ref: this.llamaProtocolsUrl,
        isDisabled: false,
      }));
  }

  private async loadContractsForProtocol(params: {
    protocolKey: string,
    slug: string,
  }): Promise<ProtocolsSourceContractT[]> {
    const {
      protocolKey,
      slug,
    } = params;

    const files = await this.fetchAdapterFiles({
      slug,
    });

    if (files.length === 0) {
      return [];
    }

    const out: ProtocolsSourceContractT[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const file of files) {
      if (!file.download_url) {
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const content = await this.fetchFileContent({
        downloadUrl: file.download_url,
      });

      const extracted = this.extractContractsFromAdapter({
        protocolKey,
        sourceRef: file.html_url,
        content,
      });

      out.push(...extracted);
    }

    return out;
  }

  private async fetchAdapterFiles(params: {
    slug: string,
  }): Promise<GithubContentItemT[]> {
    const {
      slug,
    } = params;

    try {
      const res = await axios.get<GithubContentItemT[]>(
        `${this.githubProjectsApiBase}/${slug}`,
        {
          timeout: 30_000,
          headers: this.githubHeaders,
        },
      );

      return res.data.filter((item) => (
        item.type === 'file'
        && Boolean(item.download_url)
        && (
          item.name.endsWith('.ts')
          || item.name.endsWith('.js')
        )
      ));
    } catch {
      return [];
    }
  }

  private async fetchFileContent(params: {
    downloadUrl: string,
  }): Promise<string> {
    const {
      downloadUrl,
    } = params;

    const res = await axios.get<string>(downloadUrl, {
      timeout: 30_000,
      responseType: 'text',
    });

    return res.data;
  }

  private extractContractsFromAdapter(params: {
    protocolKey: string,
    sourceRef: string,
    content: string,
  }): ProtocolsSourceContractT[] {
    const {
      protocolKey,
      sourceRef,
      content,
    } = params;

    const blocks = this.extractChainBlocks({
      content,
    });

    const out: ProtocolsSourceContractT[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const block of blocks) {
      const chainIdOrig = this.chainNameToId[block.chainName];

      if (!chainIdOrig) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const addresses = this.extractAddresses({
        content: block.block,
      });

      // eslint-disable-next-line no-restricted-syntax
      for (const address of addresses) {
        out.push({
          protocolKey,
          chainIdOrig,
          address,
          role: this.inferRoleFromBlock({
            block: block.block,
          }),
          source: ProtocolSourceP.defillama,
          sourceRef,
          confidence: 60,
        });
      }
    }

    return out;
  }

  private extractChainBlocks(params: {
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

    // eslint-disable-next-line no-restricted-syntax
    for (const chainName of Object.keys(this.chainNameToId)) {
      const regex = new RegExp(`${chainName}\\s*:\\s*\\{([\\s\\S]*?)\\}`, 'ig');
      let match: RegExpExecArray | null;

      // eslint-disable-next-line no-cond-assign
      while ((match = regex.exec(content)) !== null) {
        out.push({
          chainName,
          block: match[1],
        });
      }
    }

    return out;
  }

  private extractAddresses(params: {
    content: string,
  }): string[] {
    const {
      content,
    } = params;

    const matches = content.match(/0x[a-fA-F0-9]{40}/g) ?? [];

    return [...new Set(matches.map((v) => v.toLowerCase()))];
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

    return undefined;
  }

  private dedupeContracts(params: {
    items: ProtocolsSourceContractT[],
  }): ProtocolsSourceContractT[] {
    const {
      items,
    } = params;

    const map = new Map<string, ProtocolsSourceContractT>();

    // eslint-disable-next-line no-restricted-syntax
    for (const item of items) {
      const key = `${item.chainIdOrig}:${item.address.toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          ...item,
          protocolKey: item.protocolKey.toLowerCase(),
          address: item.address.toLowerCase(),
          role: item.role?.toLowerCase(),
          implementationAddress: item.implementationAddress?.toLowerCase(),
        });
      }
    }

    return [...map.values()];
  }
}
