import {
  Module,
} from '@nestjs/common';

import { ChainsModule } from '../chains/chains.module';
import { RpcModule } from '../rpc/rpc.module';

import { AddressController } from './controllers';
import {
  AddressAaveHfModule,
  AddressNativeBalanceModule,
} from './modules';
import { AddressService } from './services';

@Module({
  providers: [
    AddressService,
    AddressNativeBalanceModule,
    AddressAaveHfModule,
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
