import {
  Injectable,
} from '@nestjs/common';

import pLimit from 'p-limit';
import type {
  Abi,
  Address,
} from 'viem';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import type {
  AddressContractsInfoDataT,
  AddressContractsInfoT,
} from '../contracts-info';
import { ADDRESS_MODULES } from '../core/address-modules.keys';
import type {
  AddressModuleResultT,
  AddressModuleT,
} from '../core/address-modules.types';

type AddressTokenKindT = 'erc20' | 'erc721' | 'erc1155';

export interface AddressTokenResolvedItemT {
  address: Address,
  kind: AddressTokenKindT,
  name?: string,
  symbol?: string,
  decimals?: number,
}

export interface AddressTokensResolveDataT {
  items: AddressTokenResolvedItemT[],
  tokenContracts: Address[],
  nftContracts: Address[],
}

const ERC20_METADATA_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      name: '',
      type: 'string',
    }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      name: '',
      type: 'string',
    }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      name: '',
      type: 'uint8',
    }],
  },
] as const satisfies Abi;

const ERC721_METADATA_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      name: '',
      type: 'string',
    }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      name: '',
      type: 'string',
    }],
  },
] as const satisfies Abi;

@Injectable()
export class AddressTokensResolveModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressTokensResolve;

  requires = [
    ADDRESS_MODULES.addressContractsInfo,
  ];

  private readonly concurrency = 8;

  constructor(
    private readonly rpcClientFactory: RpcClientFactory,
  ) {}

  async run(
    params: Parameters<AddressModuleT['run']>[0],
  ): Promise<AddressModuleResultT<AddressTokensResolveDataT> | null> {
    const {
      chain,
      ctx,
    } = params;

    const contractsInfo = ctx.data[ADDRESS_MODULES.addressContractsInfo] as AddressContractsInfoDataT | undefined;

    if (!contractsInfo) {
      return null;
    }

    const tokenLikeItems = contractsInfo.items.filter(
      (item): item is AddressContractsInfoT & {
        kind: AddressTokenKindT,
      } => (
        item.kind === 'erc20'
        || item.kind === 'erc721'
        || item.kind === 'erc1155'
      ),
    );

    if (tokenLikeItems.length === 0) {
      return {
        key: this.key,
        chain,
        status: 'ok',
        data: {
          items: [],
          tokenContracts: [],
          nftContracts: [],
        },
      };
    }

    const client = await this.rpcClientFactory.getClient({
      chainIdOrig: chain.chainIdOrig,
    });

    const limit = pLimit(this.concurrency);

    const items = await Promise.all(
      tokenLikeItems.map((item) => limit(async (): Promise<AddressTokenResolvedItemT> => {
        const metadata = await this.fetchTokenMetadata({
          client,
          item,
        });

        return {
          address: item.address,
          kind: item.kind,
          ...metadata,
        };
      })),
    );

    const data = {
      items,
      tokenContracts: contractsInfo.tokenContracts,
      nftContracts: contractsInfo.nftContracts,
    };

    console.log('!!!tttt', { data });

    return {
      key: this.key,
      chain,
      status: 'ok',
      data,
    };
  }

  private async fetchTokenMetadata(params: {
    client: Awaited<ReturnType<RpcClientFactory['getClient']>>,
    item: AddressContractsInfoT & {
      kind: AddressTokenKindT,
    },
  }): Promise<{
    name?: string,
    symbol?: string,
    decimals?: number,
  }> {
    const {
      client,
      item,
    } = params;

    if (item.kind === 'erc20') {
      const [name, symbol, decimals] = await Promise.all([
        this.readString({
          client,
          address: item.address,
          abi: ERC20_METADATA_ABI,
          functionName: 'name',
        }),
        this.readString({
          client,
          address: item.address,
          abi: ERC20_METADATA_ABI,
          functionName: 'symbol',
        }),
        this.readNumber({
          client,
          address: item.address,
          abi: ERC20_METADATA_ABI,
          functionName: 'decimals',
        }),
      ]);

      return {
        name,
        symbol,
        decimals,
      };
    }

    if (item.kind === 'erc721') {
      const [name, symbol] = await Promise.all([
        this.readString({
          client,
          address: item.address,
          abi: ERC721_METADATA_ABI,
          functionName: 'name',
        }),
        this.readString({
          client,
          address: item.address,
          abi: ERC721_METADATA_ABI,
          functionName: 'symbol',
        }),
      ]);

      return {
        name,
        symbol,
      };
    }

    return {};
  }

  private async readString(params: {
    client: Awaited<ReturnType<RpcClientFactory['getClient']>>,
    address: Address,
    abi: Abi,
    functionName: 'name' | 'symbol',
  }): Promise<string | undefined> {
    const {
      client,
      address,
      abi,
      functionName,
    } = params;

    try {
      const value = await client.readContract({
        address,
        abi,
        functionName,
      });

      return (typeof value === 'string' && value.length > 0)
        ? value
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async readNumber(params: {
    client: Awaited<ReturnType<RpcClientFactory['getClient']>>,
    address: Address,
    abi: Abi,
    functionName: 'decimals',
  }): Promise<number | undefined> {
    const {
      client,
      address,
      abi,
      functionName,
    } = params;

    try {
      const value = await client.readContract({
        address,
        abi,
        functionName,
      });

      if (typeof value === 'number') {
        return value;
      }

      if (typeof value === 'bigint') {
        return Number(value);
      }

      return undefined;
    } catch {
      return undefined;
    }
  }
}
