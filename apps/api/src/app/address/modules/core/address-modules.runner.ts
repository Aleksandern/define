import type { Address } from 'viem';

import { ADDRESS_MODULES } from './address-modules.keys';
import type {
  AddressModuleResultT,
  AddressModulesChainCtxT,
  AddressModulesRunCtxT,
  AddressModuleT,
} from './address-modules.types';

export type AddressModuleStepT = AddressModuleT | AddressModuleT[];
export type AddressModulesPipelineT = AddressModuleStepT[];

interface RunnerState {
  results: AddressModuleResultT[],
  isStopped: boolean,
}

function asArray(step: AddressModuleStepT): AddressModuleT[] {
  return Array.isArray(step) ? step : [step];
}

/**
 * Module execution policy:
 * @see: ../docs/module-execution-policy.ts
 */
export async function runModulesForChainPipeline({
  address,
  chain,
  pipeline,
}: {
  address: Address,
  chain: AddressModulesChainCtxT,
  pipeline: AddressModulesPipelineT,
}): Promise<AddressModuleResultT[]> {
  const ctx: AddressModulesRunCtxT = { data: {} };

  const state = await pipeline.reduce<Promise<RunnerState>>(async (prevPromise, step) => {
    const prev = await prevPromise;
    if (prev.isStopped) return prev;

    const mods = asArray(step);

    // фильтруем по requires, если ты хочешь оставить deps как safety-net
    const runnable = mods.filter((m) => !m.requires?.length || m.requires.every((k) => ctx.data[k] !== undefined));

    const out = await Promise.all(
      runnable.map((m) => m.run({
        address,
        chain,
        ctx,
      })),
    );

    out.forEach((r) => {
      if (!r) return;
      ctx.data[r.key] = r.data;
      prev.results.push(r);
    });

    const act = out.find((r) => r?.key === ADDRESS_MODULES.chainActivity)?.data as { isActive?: boolean } | undefined;

    if (act?.isActive === false) {
      prev.isStopped = true;
    }

    return prev;
  }, Promise.resolve({
    results: [],
    isStopped: false,
  }));

  return state.results;
}

export async function runModulesForChain({
  address,
  chain,
  modules,
}: {
  address: Address,
  chain: AddressModulesChainCtxT,
  modules: AddressModuleT[],
}): Promise<AddressModuleResultT[]> {
  const ctx: AddressModulesRunCtxT = { data: {} };

  const state = await modules.reduce(
    async (prevPromise, mod) => {
      const prev = await prevPromise;

      // stop early if chain inactive
      if (prev.isStopped) {
        return prev;
      }

      // requires check
      if (mod.requires?.length) {
        const ready = mod.requires.every((k) => ctx.data[k] !== undefined);

        if (!ready) {
          return prev; // skip
        }
      }

      const r = await mod.run({
        address,
        chain,
        ctx,
      });

      if (!r) {
        return prev; // skip
      }

      ctx.data[mod.key] = r.data;
      prev.results.push(r);

      if (mod.key === ADDRESS_MODULES.chainActivity) {
        const act = r.data as { isActive?: boolean } | undefined;

        if (act?.isActive === false) {
          prev.isStopped = true;
        }
      }

      return prev;
    },

    Promise.resolve({
      results: [] as AddressModuleResultT[],
      isStopped: false,
    }),
  );

  return state.results;
}
