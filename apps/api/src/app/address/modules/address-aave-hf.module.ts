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

interface AaveHfOneMarket {
  marketKey: string,
  pool: string,
  totalDebtBase: string,
  healthFactorRaw: string,
  healthFactor: string, // "∞" или число строкой
  hasDebt: boolean,
}

interface AaveHfDataT {
  markets: AaveHfOneMarket[],
}

// eslint-disable-next-line no-bitwise
const MAX_UINT256 = (1n << 256n) - 1n;

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
            _totalCollateralBase,
            totalDebtBase,
            _availableBorrowsBase,
            _currentLiquidationThreshold,
            _ltv,
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
          const healthFactor = isInfinite ? '∞' : Number(formatUnits(healthFactorRaw, 18)).toString();

          return {
            marketKey: m.key,
            pool: m.pool,
            hasDebt,
            totalDebtBase: totalDebtBase.toString(),
            healthFactorRaw: healthFactorRaw.toString(),
            healthFactor,
          } satisfies AaveHfOneMarket;
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
