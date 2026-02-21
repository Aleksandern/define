import {
  type Address,
  createPublicClient,
  formatUnits,
  http,
  parseAbi,
} from 'viem';
import { mainnet } from 'viem/chains';

const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address;

// const poolAbi = parseAbi([
//   'function getUserAccountData(address user) view returns (\
//     uint256 totalCollateralBase, \
//     uint256 totalDebtBase, \
//     uint256 availableBorrowsBase, \
//     uint256 currentLiquidationThreshold, \
//     uint256 ltv, \
//     uint256 healthFactor\
//   )',
// ]);

const poolAbi = parseAbi([
  'function getUserAccountData(address user) view returns ('
    + 'uint256 totalCollateralBase, '
    + 'uint256 totalDebtBase, '
    + 'uint256 availableBorrowsBase, '
    + 'uint256 currentLiquidationThreshold, '
    + 'uint256 ltv, '
    + 'uint256 healthFactor'
    + ')',
]);

// const poolAbi = parseAbi([
//   `function getUserAccountData(address user) view returns
//   uint256 totalCollateralBase,
//   uint256 totalDebtBase,
//   uint256 availableBorrowsBase,
//   uint256 currentLiquidationThreshold,
//   uint256 ltv,
//   uint256 healthFactor
//   )`,
// ]);

export async function getAaveV3HealthFactorEth({
  rpcUrl, user,
}: {
  rpcUrl: string, user: Address,
}) {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: 12_000 }),
  });

  const [
    ,
    totalDebtBase,,,,
    healthFactorRaw,
  ] = (await client.readContract({
    address: AAVE_V3_POOL,
    abi: poolAbi,
    functionName: 'getUserAccountData',
    args: [user],
  })) as [bigint, bigint, bigint, bigint, bigint, bigint];

  const isNoDebt = (totalDebtBase === 0n);

  return {
    hasDebt: !isNoDebt,
    totalDebtBase, // если 0 -> нет долга (HF обычно huge)
    healthFactorRaw, // HF в 18 decimals
    healthFactor: isNoDebt ? null : Number(formatUnits(healthFactorRaw, 18)),
  };
}
