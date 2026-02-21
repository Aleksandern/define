import * as AB from '@aave-dao/aave-address-book';
import type { Address } from 'viem';

export interface AaveMarket {
  protocol: 'aave-v3',
  chainId: number,
  name: string,
  pool: Address,
  provider: Address,
  uiPoolDataProvider: Address,
  rpcUrl: string,
}

type RpcByChainId = Record<number, string>;

/**
 * Автоматически собирает массив Aave V3 markets из @aave-dao/aave-address-book.
 * Ты НЕ перечисляешь Ethereum/Arbitrum/Base вручную.
 * Единственное, что нужно — rpcByChainId (куда стучаться).
 */
export function buildAaveV3Markets(rpcByChainId: RpcByChainId): AaveMarket[] {
  const markets: AaveMarket[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const [key, value] of Object.entries(AB)) {
    // address-book экспортирует много всего; нам нужны только AaveV3*
    // eslint-disable-next-line no-continue
    if (!key.startsWith('AaveV3')) continue;
    // eslint-disable-next-line no-continue
    if (typeof value !== 'object' || value == null) continue;

    const v = value as Record<string, unknown>;

    // Проверяем, что это реально market-объект нужного формата
    const chainId: number | undefined = v.CHAIN_ID as number | undefined;
    const pool: string | undefined = v.POOL as string | undefined;
    const provider: string | undefined = v.POOL_ADDRESSES_PROVIDER as string | undefined;
    const ui: string | undefined = v.UI_POOL_DATA_PROVIDER as string | undefined;

    // eslint-disable-next-line no-continue
    if (!chainId || !pool || !provider || !ui) continue;

    const rpcUrl = rpcByChainId[chainId];
    // eslint-disable-next-line no-continue
    if (!rpcUrl) continue; // если RPC не задан — пропускаем сеть

    markets.push({
      protocol: 'aave-v3',
      chainId,
      name: key.replace(/^AaveV3/, ''), // например "Ethereum", "Arbitrum"...
      pool: pool as Address,
      provider: provider as Address,
      uiPoolDataProvider: ui as Address,
      rpcUrl,
    });
  }

  // Стабильный порядок
  markets.sort((a, b) => a.chainId - b.chainId);

  return markets;
}
