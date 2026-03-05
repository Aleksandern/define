import {
  Module,
} from '@nestjs/common';

import { ChainsModule } from '../chains/chains.module';
import { RpcModule } from '../rpc/rpc.module';

import { AddressController } from './controllers';
import {
  AddressAaveHfModule,
  AddressAssetResolveModule,
  AddressChainActivityModule,
  AddressErc20ActivityModule,
  AddressNativeBalanceModule,
  AddressProtocolDiscoveryModule,
  AddressScanModule,
} from './modules';
import { AddressService } from './services';

@Module({
  providers: [
    AddressService,
    AddressNativeBalanceModule,
    AddressAaveHfModule,
    AddressProtocolDiscoveryModule,
    AddressChainActivityModule,
    AddressErc20ActivityModule,
    AddressScanModule,
    AddressAssetResolveModule,
  ],
  controllers: [
    AddressController,
  ],
  imports: [
    RpcModule,
    ChainsModule,
  ],
  exports: [
    AddressService,
  ],
})
export class AddressModule {}
