export const ADDRESS_MODULES = {
  chainActivity: 'chainActivity',
  addressActivity: 'addressActivity',
  addressTouchedContracts: 'addressTouchedContracts',
  addressContractsInfo: 'addressContractsInfo',
  addressProtocolResolve: 'addressProtocolResolve',
  addressTokensResolve: 'addressTokensResolve',
  nativeBalance: 'nativeBalance',
} as const;

export type AddressModuleKeyT = typeof ADDRESS_MODULES[keyof typeof ADDRESS_MODULES];
