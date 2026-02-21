import {
  Module,
} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ChainsController } from './controllers';
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
import { ChainsService } from './services';

@Module({
  providers: [
    ChainsService,
    ChainsRpcsCron,
    ChainsRpcsHealthCron,
  ],
  controllers: [
    ChainsController,
  ],
  imports: [
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
    MongooseModule,
  ],
})
export class ChainsModule {}
