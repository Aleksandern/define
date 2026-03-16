import type { Address } from 'viem';

import type {
  ProtocolRegistryMatchT,
} from './protocol-registry.types';

interface ProtocolRegistryRowT {
  chainIdOrig: number,
  contract: Address,
  protocolKey: string,
  protocolName: string,
  contractRole?: string,
}

export class ProtocolRegistryService {
  private readonly rows: ProtocolRegistryRowT[] = [
    {
      chainIdOrig: 1,
      contract: '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2',
      protocolKey: 'aave_v3',
      protocolName: 'Aave V3',
      contractRole: 'pool',
    },
    {
      chainIdOrig: 42161,
      contract: '0x794a61358d6845594f94dc1db02a252b5b4814ad',
      protocolKey: 'aave_v3',
      protocolName: 'Aave V3',
      contractRole: 'pool',
    },
    {
      chainIdOrig: 1,
      contract: '0xe592427a0aece92de3edee1f18e0157c05861564',
      protocolKey: 'uniswap_v3',
      protocolName: 'Uniswap V3',
      contractRole: 'router',
    },
    {
      chainIdOrig: 1,
      contract: '0x1f98431c8ad98523631ae4a59f267346ea31f984',
      protocolKey: 'uniswap_v3',
      protocolName: 'Uniswap V3',
      contractRole: 'factory',
    },
  ];

  async findByContracts(params: {
    chainIdOrig: number,
    contracts: Address[],
  }): Promise<ProtocolRegistryMatchT[]> {
    const {
      chainIdOrig,
      contracts,
    } = params;

    const contractsSet = new Set(
      contracts.map((contract) => contract.toLowerCase()),
    );

    const rows = this.rows
      .filter((row) => (
        row.chainIdOrig === chainIdOrig
        && contractsSet.has(row.contract.toLowerCase())
      ))
      .map((row) => ({
        protocolKey: row.protocolKey,
        protocolName: row.protocolName,
        contractAddress: row.contract,
        contractRole: row.contractRole,
      }));

    return rows;
  }
}
