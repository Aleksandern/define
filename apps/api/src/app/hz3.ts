import { parseAbi } from 'viem';
import {
  type Address,
  formatUnits,
  type PublicClient,
} from 'viem';

const erc20MetaAbi = parseAbi([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
]);

/**
 * Вход: позиции из getUserReservesData (там есть underlying адреса)
 * Выход: те же позиции + symbol/decimals/name
 */
export async function enrichWithTokenMeta(params: {
  client: PublicClient,
  positions: {
    underlying: Address,
    scaledSupply: bigint,
    scaledVariableDebt: bigint,
    supplying: boolean,
    borrowing: boolean,
    collateralEnabled: boolean,
  }[],
}) {
  const {
    client, positions,
  } = params;

  // Уникальные underlying токены
  const uniq = Array.from(new Set(positions.map((p) => p.underlying.toLowerCase())))
    .map((a) => a as Address);

  // multicall: для каждого токена 3 вызова
  const calls = uniq.flatMap((token) => ([
    {
      address: token,
      abi: erc20MetaAbi,
      functionName: 'symbol' as const,
    },
    {
      address: token,
      abi: erc20MetaAbi,
      functionName: 'decimals' as const,
    },
    {
      address: token,
      abi: erc20MetaAbi,
      functionName: 'name' as const,
    },
  ]));

  const res = await client.multicall({
    contracts: calls,
    allowFailure: true,
  });

  // Собираем map token->meta
  const metaByToken = new Map<string, { symbol?: string; decimals?: number; name?: string }>();

  for (let i = 0; i < uniq.length; i += 1) {
    const symbolR = res[i * 3];
    const decR = res[i * 3 + 1];
    const nameR = res[i * 3 + 2];

    metaByToken.set(uniq[i].toLowerCase(), {
      symbol: symbolR.status === 'success' ? (symbolR.result as string) : undefined,
      decimals: decR.status === 'success' ? Number(decR.result) : undefined,
      name: nameR.status === 'success' ? (nameR.result as string) : undefined,
    });
  }

  // Мержим обратно в позиции
  return positions.map((p) => {
    const meta = metaByToken.get(p.underlying.toLowerCase()) ?? {};
    const decimals = meta.decimals ?? 18;

    return {
      ...p,
      ...meta,

      // для UI/MVP: форматируем scaled значения (это не “точно как Aave UI”, но читабельно)
      supplyFormatted: p.supplying ? formatUnits(p.scaledSupply, decimals) : '0',
      debtFormatted: p.borrowing ? formatUnits(p.scaledVariableDebt, decimals) : '0',
    };
  });
}
