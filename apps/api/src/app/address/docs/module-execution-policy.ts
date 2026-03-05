/**
 * IDEAL DEFAULT POLICY: which modules require `erc20Activity` vs only `chainActivity`
 *
 * Goal:
 * - Run as few RPC calls as possible.
 * - Keep page responsive.
 * - Avoid blocking UX because some RPCs do not support eth_getLogs.
 *
 * ------------------------------------------------------------
 * 1) `chainActivity` (HARD GATE)
 * ------------------------------------------------------------
 * Requires: ALWAYS first.
 * If chainActivity.isActive === false => STOP all other modules for this chain.
 *
 * Why: it's cheap (txCount + native balance) and strongly indicates the chain is unused.
 *
 * ------------------------------------------------------------
 * 2) `erc20Activity` (SOFT SIGNAL, best-effort)
 * ------------------------------------------------------------
 * Run after chainActivity (only if chain is active).
 * It is NOT a hard gate because eth_getLogs can be blocked or rate-limited.
 * If it fails => return status:"ok" with data.note="logs_not_supported" etc.
 *
 * ------------------------------------------------------------
 * MODULE POLICY GROUPS
 * ------------------------------------------------------------
 *
 * A) ONLY `chainActivity` (no need for erc20 signal)
 * These modules should run on any active chain:
 *
 * - nativeBalance
 * - txSummary (basic stats: txCount, lastSeenBlock if you add it)
 * - chainMetadata (explorer links, native symbol/decimals, etc.)
 * - (future) basicNftBalance if you implement via balanceOf on known contracts
 *
 * Requires:
 *   requires = ['chainActivity']
 *
 * Reason:
 * - They are cheap OR they are core UI info even without ERC20 activity.
 *
 *
 * B) REQUIRE `erc20Activity` (token-related heavy work)
 * These modules should require erc20Activity because without ERC20 activity
 * they are almost always wasted work:
 *
 * - tokenDiscovery (candidates via logs)
 * - erc20Balances (multicall balanceOf + symbol/decimals)
 * - approvals / allowances scan (it’s token/log driven)
 *
 * Requires:
 *   requires = ['chainActivity', 'erc20Activity']
 *
 * AND inside module:
 *   if (erc20Activity.hasErc20Activity === false) return null;
 *
 * Reason:
 * - If there were no token transfers/approvals, discovery/balances are usually empty.
 * - Saves a lot of RPC calls.
 *
 *
 * C) OPTIONAL `erc20Activity` (DeFi modules)
 * These modules should NOT require erc20Activity, but MAY use it as a hint.
 * If erc20Activity says "false" => skip. If "true" or "unknown" => run.
 *
 * - protocolDiscovery (Aave/Compound/Morpho detection)
 * - aaveHf (HF / account data)   // note: HF works via eth_call, no logs needed
 * - positions modules (per protocol)
 *
 * Requires:
 *   requires = ['chainActivity']
 *
 * AND inside module:
 *   const sig = erc20Signal(ctx);
 *   if (sig === false) return null; // only if we are confident there is no ERC20 activity
 *   // sig === true or undefined => continue
 *
 * Reason:
 * - Users can have DeFi positions even if logs are blocked or lookback missed history.
 * - DeFi checks are often a few eth_call and can be worth trying.
 *
 *
 * ------------------------------------------------------------
 * QUICK REFERENCE TABLE
 * ------------------------------------------------------------
 *
 * chainActivity only:
 *   - nativeBalance
 *   - chainActivity itself
 *   - (cheap) tx stats
 *
 * requires erc20Activity:
 *   - tokenDiscovery
 *   - erc20Balances
 *   - approvals/allowances
 *
 * optional erc20Activity (hint only):
 *   - protocolDiscovery
 *   - aaveHf
 *   - other protocol position modules
 *
 */
