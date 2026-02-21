import { AaveV3Ethereum } from '@aave-dao/aave-address-book';
import {
  Address,
  createPublicClient,
  http,
  parseAbi,
} from 'viem';
import { mainnet } from 'viem/chains';

// const PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e" as Address;
const PROVIDER = AaveV3Ethereum.POOL_ADDRESSES_PROVIDER;
// const UI_POOL = "0x3f78bbd206e4d3c504eb854232eda7e47e9fd8fc" as Address;
const UI_POOL = AaveV3Ethereum.UI_POOL_DATA_PROVIDER;

const uiAbi = parseAbi([
  // eslint-disable-next-line @stylistic/max-len
  'function getUserReservesData(address provider, address user) view returns ((address underlyingAsset,uint256 scaledATokenBalance,bool usageAsCollateralEnabledOnUser,uint256 scaledVariableDebt)[] userReserves,uint8 userEmodeCategory)',
]);

export async function getAaveV3UserPositions({
  rpcUrl,
  user,
}: {
  rpcUrl: string, user: Address,
}) {
  const client = createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: 12_000 }),
  });

  const [userReserves] = await client.readContract({
    address: UI_POOL,
    abi: uiAbi,
    functionName: 'getUserReservesData',
    args: [PROVIDER, user],
  });

  // оставляем только активы, где есть supply или borrow
  return userReserves
    .filter((r) => r.scaledATokenBalance > 0n || r.scaledVariableDebt > 0n)
    .map((r) => ({
      underlying: r.underlyingAsset,
      supplying: r.scaledATokenBalance > 0n,
      borrowing: r.scaledVariableDebt > 0n,
      collateralEnabled: r.usageAsCollateralEnabledOnUser,
      scaledSupply: r.scaledATokenBalance,
      scaledVariableDebt: r.scaledVariableDebt,
    }));
}
