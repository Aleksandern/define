import { ADDRESS_MODULES } from '../constants/address.modules.keys';
import type {
  AddressChainActivityDataT,
  AddressErc20ActivityDataT,
} from '../modules';
import type { AddressModulesRunCtxT } from '../types';

/**
 * True => module can be run
 * False => better to skip (return null).
 */
export function isChainActive({
  ctx,
}: {
  ctx: AddressModulesRunCtxT,
}): boolean {
  const act = (ctx.data[ADDRESS_MODULES.chainActivity] as AddressChainActivityDataT | undefined);

  // if no data - do not block
  const res = (act?.isActive !== false);

  return res;
}

/**
 * True => it makes sense to run ERC20/DeFi modules.
 * False => no point to run ERC20/DeFi modules.
 * undefined => unknown (logs not supported) - decide for yourself.
 */
export function isErc20Active({
  ctx,
}: {
  ctx: AddressModulesRunCtxT,
}): boolean | undefined {
  const e = (ctx.data[ADDRESS_MODULES.erc20Activity] as AddressErc20ActivityDataT | undefined);

  if (!e) {
    return undefined;
  }

  const res = e.hasErc20Activity;

  return res;
}
