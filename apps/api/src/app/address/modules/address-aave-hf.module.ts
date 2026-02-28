import { Injectable } from '@nestjs/common';

import {
  type Address,
  formatUnits,
  parseAbi,
} from 'viem';

import { getAaveV3MarketsByChainId } from '@appApi/chains/aave';

import { RpcClientFactory } from '../../rpc/rpc-client.factory';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModuleT,
} from '../types';

const poolAbi = parseAbi([
  'function getUserAccountData(address user) view returns ('
  + 'uint256 totalCollateralBase,'
  + 'uint256 totalDebtBase,'
  + 'uint256 availableBorrowsBase,'
  + 'uint256 currentLiquidationThreshold,'
  + 'uint256 ltv,'
  + 'uint256 healthFactor)',
]);

interface AaveHfSummaryT {
  healthFactor: string, // "∞" или "1.234..."
  hasDebt: boolean,
  totalDebtBase: string,
  totalDebtUsd: string,
  totalCollateralBase: string,
  totalCollateralUsd: string,
}

interface AaveHfDetailsT {
  availableBorrowsBase: string,
  currentLiquidationThreshold: string,
  ltv: string,
  healthFactorRaw: string,
}

interface AaveHfOneMarketT {
  marketKey: string,
  pool: string,
  summary: AaveHfSummaryT,
  details?: AaveHfDetailsT,
}

interface AaveHfDataT {
  markets: AaveHfOneMarketT[],
}

// eslint-disable-next-line no-bitwise
const MAX_UINT256 = (1n << 256n) - 1n;
// TODO: ABI https://github.com/aave-dao/aave-v3-origin
const AAVE_BASE_DECIMALS = 8;

@Injectable()
export class AddressAaveHfModule implements AddressModuleT {
  key = 'aaveHf';

  constructor(private readonly rpcClientFactory: RpcClientFactory) {}

  async run(params: {
    address: Address,
    chain: AddressModulesChainCtxT,
  }): Promise<AddressModuleResultT<AaveHfDataT> | null> {
    const {
      address, chain,
    } = params;
    const res: AddressModuleResultT<AaveHfDataT> = {
      key: this.key,
      chain,
      status: 'error',
      data: {
        markets: [],
      },
    };

    const markets = getAaveV3MarketsByChainId({ chainIdOrig: chain.chainIdOrig });

    if (markets.length === 0) {
      return null;
    }

    try {
      const client = await this.rpcClientFactory.getClient({ chainIdOrig: chain.chainIdOrig });

      const results = await Promise.all(
        markets.map(async (m) => {
          const [
            totalCollateralBase,
            totalDebtBase,
            availableBorrowsBase,
            currentLiquidationThreshold,
            ltv,
            healthFactorRaw,
          ] = await client.readContract({
            address: m.pool as Address,
            abi: poolAbi,
            functionName: 'getUserAccountData',
            args: [address],
          }) as [bigint, bigint, bigint, bigint, bigint, bigint];

          const hasDebt = totalDebtBase > 0n;
          const isInfinite = (
            !hasDebt
            || healthFactorRaw === MAX_UINT256
          );
          const healthFactor = isInfinite ? '∞' : formatUnits(healthFactorRaw, 18);

          const summary: AaveHfSummaryT = {
            healthFactor,
            hasDebt,
            totalDebtBase: formatUnits(totalDebtBase, AAVE_BASE_DECIMALS), // base currecy
            totalDebtUsd: formatUnits(totalDebtBase, AAVE_BASE_DECIMALS),
            totalCollateralBase: formatUnits(totalCollateralBase, AAVE_BASE_DECIMALS),
            totalCollateralUsd: formatUnits(totalCollateralBase, AAVE_BASE_DECIMALS),
          };
          const details: AaveHfDetailsT = {
            availableBorrowsBase: availableBorrowsBase.toString(),
            currentLiquidationThreshold: currentLiquidationThreshold.toString(),
            ltv: ltv.toString(),
            healthFactorRaw: healthFactorRaw.toString(),
          };

          return {
            marketKey: m.key,
            pool: m.pool,
            summary,
            details,
          } satisfies AaveHfOneMarketT;
        }),
      );

      res.data?.markets.push(...results);

      res.status = 'ok';
    } catch (e) {
      res.status = 'error';
      res.error = e instanceof Error ? e.message : String(e);
    }

    return res;
  }
}
