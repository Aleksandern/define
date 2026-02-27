import {
  forwardRef,
  Module,
} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// eslint-disable-next-line import-x/no-cycle
import { RpcModule } from '@appApi/app/rpc/rpc.module';

import {
  ChainsController,
  ChainsRpcsController,
} from './controllers';
import {
  ChainsRpcsCron,
  ChainsRpcsHealthCron,
} from './cron';
import {
  Chain,
  ChainSchema,
  ChainsRpc,
  ChainsRpcSchema,
} from './schemas';
import {
  ChainsRpcsService,
  ChainsService,
} from './services';

@Module({
  providers: [
    ChainsService,
    ChainsRpcsService,
    ChainsRpcsCron,
    ChainsRpcsHealthCron,
  ],
  controllers: [
    ChainsController,
    ChainsRpcsController,
  ],
  imports: [
    forwardRef(() => RpcModule),
    MongooseModule.forFeature([
      {
        name: Chain.name,
        schema: ChainSchema,
      },
      {
        name: ChainsRpc.name,
        schema: ChainsRpcSchema,
      },
    ]),
  ],
  exports: [
    ChainsService,
    ChainsRpcsService,
    MongooseModule,
  ],
})
export class ChainsModule {}
