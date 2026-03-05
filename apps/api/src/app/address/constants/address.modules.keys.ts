export const ADDRESS_MODULES = {
  chainActivity: 'chainActivity',
  addressScan: 'addressScan',
  addressAssetResolve: 'addressAssetResolve',
  erc20Activity: 'erc20Activity',
  nativeBalance: 'nativeBalance',
  protocolDiscovery: 'protocolDiscovery',
  aaveHf: 'aaveHf',
} as const;

export type AddressModuleKeyT = typeof ADDRESS_MODULES[keyof typeof ADDRESS_MODULES];
