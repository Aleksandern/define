import { Injectable } from '@nestjs/common';

import {
  createPublicClient,
  formatEther,
  formatUnits,
  http,
  parseAbi,
} from 'viem';
import { mainnet } from 'viem/chains';

import {
  getAaveV3UserPositions,
} from './hz';
import { getAaveV3HealthFactorEth } from './hz2';
import { enrichWithTokenMeta } from './hz3';

@Injectable()
export class AppService {
  async getData(): Promise<{ message: string }> {
    const address = '0x62ac6a66b929f8975c27904a8f31c78155e89634';

    const chains = [
      {
        chain: mainnet,
        rpcUrl: mainnet.rpcUrls.default.http[0],
      },
    // { chain: arbitrum, rpcUrl: "https://arb1.arbitrum.io/rpc" },
    // { chain: optimism, rpcUrl: "https://mainnet.optimism.io" },
    // { chain: base, rpcUrl: "https://mainnet.base.org" },
    // { chain: polygon, rpcUrl: "https://polygon-rpc.com" },
    ];

    const aavePoolAbi = parseAbi([
      // eslint-disable-next-line @stylistic/max-len
      'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
    ]);

    const jobs = chains.map(async ({
      chain, rpcUrl,
    }) => {
      const client = createPublicClient({
        chain,
        transport: http(rpcUrl, { timeout: 12_000 }),
      });

      const wei = await client.getBalance({ address });

      const resTmp0 = await client.readContract({
        address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
        abi: aavePoolAbi,
        functionName: 'getUserAccountData',
        args: [address],
      });

      const [
        ,
        ,
        ,
        ,
        ,
        healthFactorRaw,
      ] = resTmp0;
      const healthFactor = Number(formatUnits(healthFactorRaw, 18));

      console.log('!!!000', { resTmp0 });
      console.log('!!!000', { healthFactor });

      // const blockNumber = await client.getBlockNumber();
      // https://github.com/ethereum-lists/chains

      // const qq = await Promise.all([
      //   client.readContract({
      //     address,
      //     abi: erc20Abi,
      //     functionName: 'balanceOf',
      //     args: [address],
      //   }),
      //   // client.readContract({
      //   //   address,
      //   //   abi: erc20Abi,
      //   //   functionName: 'decimals',
      //   // }),
      //   // client.readContract({
      //   //   address,
      //   //   abi: erc20Abi,
      //   //   functionName: 'symbol',
      //   // }),
      // ])

      // console.log('!!!', { qq });

      const resTmp = {
        chainId: chain.id,
        chainName: chain.name,
        native: {
          wei: wei.toString(),
          value: formatEther(wei),
        },
      // erc20: {
      //   row: hhz.
      // },
      };

      return resTmp;
    });

    const settled = await Promise.allSettled(jobs);
    // console.log('!!!', { jobs });

    const res = settled.map((item) => {
      console.log('!!!', { item }, item.status);
      const resTmp = {
        data: undefined as object | undefined,
        isOk: false,
      };

      if (item.status === 'fulfilled') {
        resTmp.isOk = true;
        resTmp.data = item.value;
      }

      return resTmp;
    });

    console.log('!!!BATCH', { res });

    const client = createPublicClient({
      chain: mainnet,
      transport: http(chains[0].rpcUrl, { timeout: 12_000 }),
    });

    const positions = await getAaveV3UserPositions({
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
      user: address,
    });

    console.log('!!!AI', { positions });

    const hf = await getAaveV3HealthFactorEth({
      rpcUrl: 'https://ethereum-rpc.publicnode.com',
      user: address,
    });

    console.log('!!!AI2222', { hf });

    const enriched = await enrichWithTokenMeta({
      client,
      positions,
    });

    console.log('[ !!!enriched ]', enriched);

    // const client = createPublicClient({
    //   chain: mainnet,
    //   transport: http("https://ethereum-rpc.publicnode.com"), // пример публичного RPC
    // });

    // const address = '0xf7b10d603907658f690da534e9b7dbc4dab3e2d6';

    // const balanceWei = await client.getBalance({ address });

    // const balance = {
    //   wei: balanceWei.toString(),
    //   eth: formatEther(balanceWei),
    // };

    // console.log('[ !!!balanceWei ]', balanceWei);
    // console.log('!!!', { balance });
    // console.log('!!!111', {  });

    return ({ message: 'Hello API' });
  }
}
