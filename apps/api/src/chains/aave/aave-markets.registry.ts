import * as AB from '@aave-dao/aave-address-book';

export interface AaveV3Market {
  key: string, // for example "AaveV3Ethereum"
  chainId: number, // AB.*.CHAIN_ID
  pool: string, // AB.*.POOL
}

function isAaveV3Market(
  x: unknown,
): x is { CHAIN_ID: number; POOL: string } {
  if (
    !x
    || (typeof x !== 'object')
  ) {
    return false;
  }

  const v = x as Record<string, unknown>;

  const res = (
    (typeof v.CHAIN_ID === 'number')
    && (typeof v.POOL === 'string')
  );

  return res;
}

/**
 * Returns all Aave v3 markets on a specific network.
 * (there can be multiple markets on one network)
 */
export function getAaveV3MarketsByChainId({
  chainIdOrig,
} : {
  chainIdOrig: number,
}): AaveV3Market[] {
  const res: AaveV3Market[] = [];

  Object.entries(AB).forEach(([key, value]) => {
    if (!isAaveV3Market(value)) {
      return;
    }

    if (value.CHAIN_ID !== chainIdOrig) {
      return;
    }

    if (!key.startsWith('AaveV3')) {
      return;
    }

    const typedValue = value as typeof value & { POOL: string };

    res.push({
      key,
      chainId: typedValue.CHAIN_ID,
      pool: typedValue.POOL,
    });
  });

  return res;
}
