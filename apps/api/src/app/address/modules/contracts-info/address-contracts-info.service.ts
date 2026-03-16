import type { Address } from 'viem';
import { parseAbi } from 'viem';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import type { AddressContractsInfoT } from './address-contracts-info.types';

const erc165Abi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
]);

const erc20Abi = parseAbi([
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
]);

const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC1155_INTERFACE_ID = '0xd9b67a26';

export class AddressContractsInfoService {
  constructor(
    private readonly rpcClientFactory: RpcClientFactory,
  ) {}

  async resolveOne(params: {
    chainIdOrig: number,
    contract: Address,
  }): Promise<AddressContractsInfoT> {
    const {
      chainIdOrig,
      contract,
    } = params;

    const client = await this.rpcClientFactory.getClient({
      chainIdOrig,
    });

    const code = await client.getCode({
      address: contract,
    });

    if (!code || code === '0x') {
      return {
        address: contract,
        isContract: false,
        kind: 'unknown',
      };
    }

    let supportsErc165 = false;
    let supportsErc721 = false;
    let supportsErc1155 = false;

    try {
      const [is721, is1155] = await Promise.all([
        client.readContract({
          address: contract,
          abi: erc165Abi,
          functionName: 'supportsInterface',
          args: [ERC721_INTERFACE_ID],
        }),
        client.readContract({
          address: contract,
          abi: erc165Abi,
          functionName: 'supportsInterface',
          args: [ERC1155_INTERFACE_ID],
        }),
      ]);

      supportsErc165 = true;
      supportsErc721 = Boolean(is721);
      supportsErc1155 = Boolean(is1155);
    } catch {
      //
    }

    if (supportsErc721) {
      return {
        address: contract,
        isContract: true,
        kind: 'erc721',
        supportsErc165,
        supportsErc721,
        supportsErc1155,
      };
    }

    if (supportsErc1155) {
      return {
        address: contract,
        isContract: true,
        kind: 'erc1155',
        supportsErc165,
        supportsErc721,
        supportsErc1155,
      };
    }

    let symbol: string | undefined;
    let name: string | undefined;
    let decimals: number | undefined;

    try {
      const res = await client.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'symbol',
      });

      if (typeof res === 'string' && res.length > 0 && res.length <= 64) {
        symbol = res;
      }
    } catch {
      //
    }

    try {
      const res = await client.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'name',
      });

      if (typeof res === 'string' && res.length > 0 && res.length <= 128) {
        name = res;
      }
    } catch {
      //
    }

    try {
      const res = await client.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'decimals',
      });

      if (
        typeof res === 'number'
        && Number.isInteger(res)
        && res >= 0
        && res <= 255
      ) {
        decimals = res;
      }
    } catch {
      //
    }

    const isErc20Like = (
      typeof symbol === 'string'
      || typeof name === 'string'
      || typeof decimals === 'number'
    );

    return {
      address: contract,
      isContract: true,
      kind: isErc20Like ? 'erc20' : 'contract',
      symbol,
      name,
      decimals,
      supportsErc165,
      supportsErc721,
      supportsErc1155,
    };
  }
}
