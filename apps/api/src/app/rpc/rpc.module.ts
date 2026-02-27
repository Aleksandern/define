import {
  forwardRef,
  Module,
} from '@nestjs/common';

// eslint-disable-next-line import-x/no-cycle
import { ChainsModule } from '@appApi/app/chains/chains.module';

import { RpcClientFactory } from './rpc-client.factory';
import { RpcService } from './services';

@Module({
  providers: [
    RpcService,
    RpcClientFactory,
  ],
  controllers: [
  ],
  imports: [
    forwardRef(() => ChainsModule),
  ],
  exports: [
    RpcClientFactory,
    RpcService,
  ],
})
export class RpcModule {}
