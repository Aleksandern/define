export type RpcLogsErrorTypeT = (
  | 'logs_not_supported' // TODO: needs other RPC
  | 'range_too_wide'
  | 'rate_limited'
  | 'timeout'
  | 'unknown'
);

export function classifyRpcLogsError(e: unknown): RpcLogsErrorTypeT {
  const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();

  if (
    msg.includes('eth_getlogs')
    && (
      msg.includes('not supported')
      || msg.includes('method not found')
      || msg.includes('does not exist')
      || msg.includes('not available')
      || msg.includes('not whitelisted')
    )
  ) {
    return 'logs_not_supported';
  }

  if (
    msg.includes('too many results')
    || msg.includes('query returned more than')
    || msg.includes('range too wide')
    || msg.includes('response size exceeded')
  ) {
    return 'range_too_wide';
  }

  if (
    msg.includes('rate limit')
    || msg.includes('too many requests')
    || msg.includes('429')
  ) {
    return 'rate_limited';
  }

  if (
    msg.includes('timeout')
    || msg.includes('timed out')
    || msg.includes('etimedout')
  ) {
    return 'timeout';
  }

  return 'unknown';
}
