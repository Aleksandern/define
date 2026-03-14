import { Injectable } from '@nestjs/common';

import pLimit from 'p-limit';
import type {
  Address,
} from 'viem';
import {
  parseAbi,
} from 'viem';

import { getAaveV3MarketsByChainId } from '@appApi/chains/aave';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import { ADDRESS_MODULES } from '../constants/address.modules.keys';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModulesRunCtxT,
  AddressModuleT,
} from '../types';

import type {
  AddressScanDataT,
  AddressScanLogT,
} from './address-scan.module';

type AddressResolvedKindT = (
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'protocol'
  | 'unknown'
);

interface AddressResolvedProtocolT {
  key: string,
  name?: string,
}

interface AddressResolvedTokenMetaT {
  symbol?: string,
  decimals?: number,
  name?: string,
  balance?: string,
}

export interface AddressResolvedItemT {
  address: Address,
  kind: AddressResolvedKindT,
  token?: AddressResolvedTokenMetaT,
  protocol?: AddressResolvedProtocolT,
}

export interface AddressAssetResolveDataT {
  items: AddressResolvedItemT[],
  erc20Candidates: Address[],
  protocolCandidates: Address[],
  nftCandidates: Address[],
  unknownCandidates: Address[],
  scannedFromBlock: string,
  scannedToBlock: string,
  note?: AddressScanDataT['note'],
}

const erc165Abi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
]);

const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
]);

// bytes32 fallback для нестандартных токенов здесь пока не добавляю,
// чтобы модуль не разрастался. Если понадобится — добавим отдельно.

const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC1155_INTERFACE_ID = '0xd9b67a26';

function collectCandidateAddresses({
  scan,
}: {
  scan: AddressScanDataT,
}): Address[] {
  const set = new Set<string>();

  const pushLog = (log: AddressScanLogT) => {
    set.add(log.address.toLowerCase());
  };

  scan.logsTopic1.forEach(pushLog);
  scan.logsTopic2.forEach(pushLog);

  return Array.from(set) as Address[];
}

function hasTokenLikeEvidence({
  candidate,
  scan,
}: {
  candidate: Address,
  scan: AddressScanDataT,
}): boolean {
  const candidateLc = candidate.toLowerCase();

  const logs = [
    ...scan.logsTopic1,
    ...scan.logsTopic2,
  ];

  const res = logs.some((log) => (
    log.address.toLowerCase() === candidateLc
  ));

  return res;
}

@Injectable()
export class AddressAssetResolveModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressAssetResolve;

  requires = [ADDRESS_MODULES.addressScan];

  private readonly concurrency = 5;

  constructor(
    private readonly rpcClientFactory: RpcClientFactory,
  ) {}

  async run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
    ctx: AddressModulesRunCtxT,
  }): Promise<AddressModuleResultT<AddressAssetResolveDataT> | null> {
    const {
      address,
      chain,
      ctx,
    } = params;

    const scan = ctx.data[ADDRESS_MODULES.addressScan] as AddressScanDataT | undefined;

    if (!scan) {
      return null;
    }

    const res: AddressModuleResultT<AddressAssetResolveDataT> = {
      key: this.key,
      chain,
      status: 'ok',
      data: {
        items: [],
        erc20Candidates: [],
        protocolCandidates: [],
        nftCandidates: [],
        unknownCandidates: [],
        scannedFromBlock: scan.scannedFromBlock,
        scannedToBlock: scan.scannedToBlock,
        ...(scan.note ? { note: scan.note } : {}),
      },
    };

    const candidates = collectCandidateAddresses({ scan });

    if (!candidates.length) {
      return res;
    }

    try {
      const client = await this.rpcClientFactory.getClient({
        chainIdOrig: chain.chainIdOrig,
      });

      // known protocols START
      const aaveMarkets = getAaveV3MarketsByChainId({
        chainIdOrig: chain.chainIdOrig,
      });

      console.log('!!!', { aaveMarkets });

      const protocolMap = new Map<string, AddressResolvedItemT>();

      aaveMarkets.forEach((m) => {
        protocolMap.set(m.pool.toLowerCase(), {
          address: m.pool as Address,
          kind: 'protocol',
          protocol: {
            key: m.key,
            name: 'Aave v3',
          },
        });
      });
      // known protocols END

      const limit = pLimit(this.concurrency);

      const items = await Promise.all(
        candidates.map((candidate) => limit(async () => {
          const candidateLc = candidate.toLowerCase();

          // 1) known protocol registry START
          const knownProtocol = protocolMap.get(candidateLc);
          if (knownProtocol) {
            return knownProtocol;
          }
          // 1) known protocol registry END

          // 2) NFT via ERC165 START
          try {
            const [is721, is1155] = await Promise.all([
              client.readContract({
                address: candidate,
                abi: erc165Abi,
                functionName: 'supportsInterface',
                args: [ERC721_INTERFACE_ID],
              }),
              client.readContract({
                address: candidate,
                abi: erc165Abi,
                functionName: 'supportsInterface',
                args: [ERC1155_INTERFACE_ID],
              }),
            ]);

            if (is721) {
              return {
                address: candidate,
                kind: 'erc721',
              } satisfies AddressResolvedItemT;
            }

            if (is1155) {
              return {
                address: candidate,
                kind: 'erc1155',
              } satisfies AddressResolvedItemT;
            }
          } catch {
            // many contracts do not support ERC165
          }
          // 2) NFT via ERC165 END

          // 3) ERC20-like soft resolve START
          const hasEvidence = hasTokenLikeEvidence({
            candidate,
            scan,
          });

          let balanceOk = false;
          let symbolOk = false;
          let decimalsOk = false;
          let nameOk = false;

          let balanceValue: bigint | undefined;
          let symbolValue: string | undefined;
          let decimalsValue: number | undefined;
          let nameValue: string | undefined;

          try {
            const balance = await client.readContract({
              address: candidate,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address],
            });

            if (typeof balance === 'bigint') {
              balanceOk = true;
              balanceValue = balance;
            }
          } catch {
            //
          }

          try {
            const symbol = await client.readContract({
              address: candidate,
              abi: erc20Abi,
              functionName: 'symbol',
            });

            if (
              (typeof symbol === 'string')
              && symbol.length > 0
              && symbol.length <= 64
            ) {
              symbolOk = true;
              symbolValue = symbol;
            }
          } catch {
            //
          }

          try {
            const decimals = await client.readContract({
              address: candidate,
              abi: erc20Abi,
              functionName: 'decimals',
            });

            if (
              (typeof decimals === 'number')
              && Number.isInteger(decimals)
              && decimals >= 0
              && decimals <= 255
            ) {
              decimalsOk = true;
              decimalsValue = decimals;
            }
          } catch {
            //
          }

          try {
            const name = await client.readContract({
              address: candidate,
              abi: erc20Abi,
              functionName: 'name',
            });

            if (
              (typeof name === 'string')
              && name.length > 0
              && name.length <= 128
            ) {
              nameOk = true;
              nameValue = name;
            }
          } catch {
            //
          }

          // мягкая эвристика:
          // - должен быть хотя бы один token-like лог
          // - и хотя бы 2 ERC20 сигнала
          const score = Number(balanceOk) + Number(symbolOk) + Number(decimalsOk) + Number(nameOk);
          const isErc20Like = hasEvidence && (score >= 2);

          if (isErc20Like) {
            return {
              address: candidate,
              kind: 'erc20',
              token: {
                ...(symbolOk ? { symbol: symbolValue } : {}),
                ...(decimalsOk ? { decimals: decimalsValue } : {}),
                ...(nameOk ? { name: nameValue } : {}),
                ...(balanceOk ? { balance: balanceValue?.toString() } : {}),
              },
            } satisfies AddressResolvedItemT;
          }
          // 3) ERC20-like soft resolve END

          return {
            address: candidate,
            kind: 'unknown',
          } satisfies AddressResolvedItemT;
        })),
      );

      res.data!.items = items;
      res.data!.erc20Candidates = items
        .filter((v) => v.kind === 'erc20')
        .map((v) => v.address);

      res.data!.protocolCandidates = items
        .filter((v) => v.kind === 'protocol')
        .map((v) => v.address);

      res.data!.nftCandidates = items
        .filter((v) => (
          (v.kind === 'erc721')
          || (v.kind === 'erc1155')
        ))
        .map((v) => v.address);

      res.data!.unknownCandidates = items
        .filter((v) => v.kind === 'unknown')
        .map((v) => v.address);

      console.log('!!!', { res });

      return res;
    } catch (e) {
      res.status = 'error';
      res.error = e instanceof Error ? e.message : String(e);

      return res;
    }
  }
}
