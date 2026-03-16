import axios from 'axios';
import type {
  Address,
  Hex,
} from 'viem';

import type {
  AddressActivityDataT,
  AddressActivityLogT,
  AddressActivityProviderT,
  AddressActivityTransferCategoryT,
  AddressActivityTransferT,
  AddressActivityTxT,
  AlchemyGetAssetTransfersParamsT,
} from '../types';

interface AlchemyTransferRawContractT {
  address?: Address | null,
  value?: string | null,
  decimal?: string | null,
}

interface AlchemyTransferRawT {
  blockNum?: string,
  uniqueId?: string,
  hash?: Hex,
  from?: Address,
  to?: Address,
  value?: number | string | null,
  asset?: string | null,
  category?: Exclude<AddressActivityTransferCategoryT, 'unknown'>,
  rawContract?: AlchemyTransferRawContractT,
  metadata?: {
    blockTimestamp?: string,
  } | Record<string, unknown>,
  erc721TokenId?: string | null,
  erc1155Metadata?: unknown,
  tokenId?: string | null,
}

interface AlchemyTransfersRespT {
  transfers?: AlchemyTransferRawT[],
  pageKey?: string,
}

interface TxReceiptLogRawT {
  address: Address,
  topics: Hex[],
  data: Hex,
  transactionHash?: Hex,
  blockNumber?: Hex,
  logIndex?: Hex,
}

interface TxReceiptRawT {
  transactionHash: Hex,
  from?: Address,
  to?: Address | null,
  blockNumber?: Hex,
  logs?: TxReceiptLogRawT[],
}

interface RpcJsonSuccessT<T> {
  jsonrpc?: string,
  id?: number | string | null,
  result: T,
}

interface RpcJsonErrorT {
  jsonrpc?: string,
  id?: number | string | null,
  error: unknown,
}

type RpcJsonRespT<T> = (
  | RpcJsonSuccessT<T>
  | RpcJsonErrorT
);

function hasRpcError<T>(data: RpcJsonRespT<T>): data is RpcJsonErrorT {
  return 'error' in data;
}

function hasRpcResult<T>(data: RpcJsonRespT<T>): data is RpcJsonSuccessT<T> {
  return 'result' in data;
}

export class AddressActivityAlchemyProvider implements AddressActivityProviderT {
  private readonly apiKey = process.env.ALCHEMY_API_KEY ?? '';

  private readonly maxTransfersPerRequest: Hex = '0x3e8'; // 1000, Alchemy max

  private readonly maxPagesPerSide = 5;

  private readonly receiptsConcurrency = 10;

  private readonly chainRpcUrlMap: Record<number, string> = {
    1: `https://eth-mainnet.g.alchemy.com/v2/${this.apiKey}`,
    10: `https://opt-mainnet.g.alchemy.com/v2/${this.apiKey}`,
    137: `https://polygon-mainnet.g.alchemy.com/v2/${this.apiKey}`,
    42161: `https://arb-mainnet.g.alchemy.com/v2/${this.apiKey}`,
    8453: `https://base-mainnet.g.alchemy.com/v2/${this.apiKey}`,
  };

  private getRpcUrl(params: {
    chainIdOrig: number,
  }): string {
    const {
      chainIdOrig,
    } = params;

    if (!this.apiKey) {
      throw new Error('ALCHEMY_API_KEY is not configured');
    }

    const url = this.chainRpcUrlMap[chainIdOrig];

    if (!url) {
      throw new Error(`Alchemy is not configured for chainIdOrig=${chainIdOrig}`);
    }

    return url;
  }

  private async rpcCall<T>(params: {
    url: string,
    method: string,
    params: unknown[],
  }): Promise<T> {
    const {
      url,
      method,
      params: rpcParams,
    } = params;

    const res = await axios.post<RpcJsonRespT<T>>(url, {
      jsonrpc: '2.0',
      id: 1,
      method,
      params: rpcParams,
    }, {
      timeout: 15_000,
      headers: {
        'content-type': 'application/json',
      },
    });

    const {
      data,
    } = res;

    if (hasRpcError(data)) {
      throw new Error(
        `Alchemy RPC error for ${method}: ${JSON.stringify(data.error)}`,
      );
    }

    if (!hasRpcResult(data)) {
      throw new Error(`Alchemy RPC response for ${method} does not contain result`);
    }

    return data.result;
  }

  private buildGetAssetTransfersRequest(params: {
    address: Address,
    direction: 'from' | 'to',
    pageKey?: string,
  }): AlchemyGetAssetTransfersParamsT {
    const {
      address,
      direction,
      pageKey,
    } = params;

    const request: AlchemyGetAssetTransfersParamsT = {
      fromBlock: '0x0',
      toBlock: 'latest',
      excludeZeroValue: false,
      category: ['external', 'internal', 'erc20', 'erc721', 'erc1155', 'specialnft'],
      order: 'desc',
      withMetadata: true,
      maxCount: this.maxTransfersPerRequest,
      ...(direction === 'from'
        ? { fromAddress: address }
        : { toAddress: address }),
      ...(pageKey ? { pageKey } : {}),
    };

    return request;
  }

  private async getAssetTransfersPage(params: {
    url: string,
    address: Address,
    direction: 'from' | 'to',
    pageKey?: string,
  }): Promise<AlchemyTransfersRespT> {
    const {
      url,
      address,
      direction,
      pageKey,
    } = params;

    const request = this.buildGetAssetTransfersRequest({
      address,
      direction,
      pageKey,
    });

    return this.rpcCall<AlchemyTransfersRespT>({
      url,
      method: 'alchemy_getAssetTransfers',
      params: [request],
    });
  }

  private async getAllTransfersForDirection(params: {
    url: string,
    address: Address,
    direction: 'from' | 'to',
  }): Promise<{
    transfers: AlchemyTransferRawT[],
    nextCursor?: string,
  }> {
    const {
      url,
      address,
      direction,
    } = params;

    const transfers: AlchemyTransferRawT[] = [];
    let pageKey: string | undefined;
    let pagesRead = 0;

    while (pagesRead < this.maxPagesPerSide) {
      // eslint-disable-next-line no-await-in-loop
      const resp = await this.getAssetTransfersPage({
        url,
        address,
        direction,
        pageKey,
      });

      transfers.push(...(resp.transfers ?? []));
      pagesRead += 1;

      if (!resp.pageKey) {
        return {
          transfers,
        };
      }

      pageKey = resp.pageKey;
    }

    return {
      transfers,
      nextCursor: pageKey,
    };
  }

  private async getReceipt(params: {
    url: string,
    txHash: Hex,
  }): Promise<TxReceiptRawT | null> {
    const {
      url,
      txHash,
    } = params;

    return this.rpcCall<TxReceiptRawT | null>({
      url,
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });
  }

  private async getReceiptsLimited(params: {
    url: string,
    txHashes: Hex[],
  }): Promise<(TxReceiptRawT | null)[]> {
    const {
      url,
      txHashes,
    } = params;

    const results = Array<TxReceiptRawT | null>(txHashes.length).fill(null);
    let index = 0;

    const worker = async () => {
      while (true) {
        const current = index;
        index += 1;

        if (current >= txHashes.length) {
          return;
        }

        // eslint-disable-next-line no-await-in-loop
        results[current] = await this.getReceipt({
          url,
          txHash: txHashes[current],
        });
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(this.receiptsConcurrency, txHashes.length) },
        () => worker(),
      ),
    );

    return results;
  }

  async fetch(params: {
    address: Address,
    chainIdOrig: number,
  }): Promise<AddressActivityDataT> {
    const {
      address,
      chainIdOrig,
    } = params;

    const url = this.getRpcUrl({
      chainIdOrig,
    });

    const [incomingRes, outgoingRes] = await Promise.all([
      this.getAllTransfersForDirection({
        url,
        address,
        direction: 'to',
      }),
      this.getAllTransfersForDirection({
        url,
        address,
        direction: 'from',
      }),
    ]);

    const transfersRaw = [
      ...incomingRes.transfers,
      ...outgoingRes.transfers,
    ];

    const transfers: AddressActivityTransferT[] = transfersRaw.map((item) => ({
      txHash: item.hash,
      from: item.from,
      to: item.to,
      contractAddress: item.rawContract?.address ?? undefined,
      category: item.category ?? 'unknown',
      value: (
        item.rawContract?.value
        ?? (item.value !== undefined && item.value !== null
          ? String(item.value)
          : undefined)
      ),
      blockNumber: item.blockNum,
      raw: item,
    }));

    const txHashSet = new Set<string>();

    transfers.forEach((transfer) => {
      if (transfer.txHash) {
        txHashSet.add(transfer.txHash.toLowerCase());
      }
    });

    const txHashes = Array.from(txHashSet) as Hex[];

    const receipts = await this.getReceiptsLimited({
      url,
      txHashes,
    });

    const txs: AddressActivityTxT[] = [];
    const logs: AddressActivityLogT[] = [];
    const touchedContractsSet = new Set<string>();

    receipts.forEach((receipt) => {
      if (!receipt) {
        return;
      }

      txs.push({
        hash: receipt.transactionHash,
        from: receipt.from,
        to: receipt.to ?? undefined,
        blockNumber: receipt.blockNumber
          ? BigInt(receipt.blockNumber).toString()
          : undefined,
        raw: receipt,
      });

      if (receipt.to) {
        touchedContractsSet.add(receipt.to.toLowerCase());
      }

      (receipt.logs ?? []).forEach((log) => {
        logs.push({
          address: log.address,
          topics: log.topics,
          data: log.data,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber
            ? BigInt(log.blockNumber).toString()
            : undefined,
          logIndex: log.logIndex
            ? BigInt(log.logIndex).toString()
            : undefined,
          raw: log,
        });

        touchedContractsSet.add(log.address.toLowerCase());
      });
    });

    transfers.forEach((transfer) => {
      if (transfer.contractAddress) {
        touchedContractsSet.add(transfer.contractAddress.toLowerCase());
      }
    });

    const touchedContracts = Array.from(touchedContractsSet) as Address[];

    return {
      source: 'alchemy',
      txs,
      logs,
      transfers,
      touchedContracts,
      incomingNextCursor: incomingRes.nextCursor,
      outgoingNextCursor: outgoingRes.nextCursor,
    };
  }
}
