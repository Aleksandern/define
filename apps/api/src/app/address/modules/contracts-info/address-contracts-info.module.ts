import { Injectable } from '@nestjs/common';

import pLimit from 'p-limit';
import type { Address } from 'viem';

import { RpcClientFactory } from '@appApi/app/rpc/rpc-client.factory';

import type {
  AddressActivityDataT,
  AddressActivityTransferCategoryT,
} from '../activity/types';
import { ADDRESS_MODULES } from '../core/address-modules.keys';
import type {
  AddressModuleResultT,
  AddressModuleT,
} from '../core/address-modules.types';
import type {
  AddressTouchedContractsDataT,
} from '../touched-contracts';

import {
  AddressContractsInfoService,
} from './address-contracts-info.service';
import type {
  AddressContractsInfoT,
  AddressContractsKindT,
} from './address-contracts-info.types';

export interface AddressContractsInfoDataT {
  items: AddressContractsInfoT[],
  tokenContracts: Address[],
  nftContracts: Address[],
  protocolContractCandidates: Address[],
}

type TransferCategoryContractHintT = Extract<
  AddressActivityTransferCategoryT,
'erc20' | 'erc721' | 'erc1155'
>;

function categoryToKind(category: TransferCategoryContractHintT): AddressContractsKindT {
  if (category === 'erc20') {
    return 'erc20';
  }

  if (category === 'erc721') {
    return 'erc721';
  }

  return 'erc1155';
}

function buildContractHints(params: {
  activity: AddressActivityDataT,
}): Map<string, TransferCategoryContractHintT> {
  const {
    activity,
  } = params;

  const hints = new Map<string, TransferCategoryContractHintT>();

  activity.transfers.forEach((transfer) => {
    const contractAddress = transfer.contractAddress?.toLowerCase();
    const { category } = transfer;

    if (!contractAddress) {
      return;
    }

    if (
      category !== 'erc20'
      && category !== 'erc721'
      && category !== 'erc1155'
    ) {
      return;
    }

    const prev = hints.get(contractAddress);

    if (!prev) {
      hints.set(contractAddress, category);
    }

    // if conflicting hints come for the same address,
    // we prefer not to change a more "token-like" classification,
    // and consider the first signal sufficient for the fast-path
  });

  return hints;
}

function buildInfoFromHint(params: {
  contract: Address,
  category: TransferCategoryContractHintT,
}): AddressContractsInfoT {
  const {
    contract,
    category,
  } = params;

  const kind = categoryToKind(category);

  return {
    address: contract,
    isContract: true,
    kind,
    supportsErc165: kind === 'erc721' || kind === 'erc1155' ? undefined : false,
    supportsErc721: kind === 'erc721',
    supportsErc1155: kind === 'erc1155',
  };
}

@Injectable()
export class AddressContractsInfoModule implements AddressModuleT {
  key = ADDRESS_MODULES.addressContractsInfo;

  requires = [
    ADDRESS_MODULES.addressActivity,
    ADDRESS_MODULES.addressTouchedContracts,
  ];

  private readonly contractInfoService: AddressContractsInfoService;

  private readonly concurrency = 5;

  constructor(
    private readonly rpcClientFactory: RpcClientFactory,
  ) {
    this.contractInfoService = new AddressContractsInfoService(this.rpcClientFactory);
  }

  async run(
    params: Parameters<AddressModuleT['run']>[0],
  ): Promise<AddressModuleResultT<AddressContractsInfoDataT> | null> {
    const {
      chain,
      ctx,
    } = params;

    const activity = ctx.data[ADDRESS_MODULES.addressActivity] as AddressActivityDataT | undefined;
    const touched = ctx.data[ADDRESS_MODULES.addressTouchedContracts] as AddressTouchedContractsDataT | undefined;

    if (!activity || !touched) {
      return null;
    }

    const hints = buildContractHints({
      activity,
    });

    const limit = pLimit(this.concurrency);

    const items = await Promise.all(
      touched.contracts.map((contract) => limit(async () => {
        const hint = hints.get(contract.toLowerCase());

        if (hint) {
          return buildInfoFromHint({
            contract,
            category: hint,
          });
        }

        return this.contractInfoService.resolveOne({
          chainIdOrig: chain.chainIdOrig,
          contract,
        });
      })),
    );

    const tokenContracts = items
      .filter((item) => item.kind === 'erc20')
      .map((item) => item.address);

    const nftContracts = items
      .filter((item) => item.kind === 'erc721' || item.kind === 'erc1155')
      .map((item) => item.address);

    const protocolContractCandidates = items
      .filter((item) => item.kind === 'contract')
      .map((item) => item.address);

    const data = {
      items,
      tokenContracts,
      nftContracts,
      protocolContractCandidates,
    };
    console.log('!!!info', { data });

    return {
      key: this.key,
      chain,
      status: 'ok',
      data,
    };
  }
}
