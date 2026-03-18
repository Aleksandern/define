import {
  Module,
} from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ChainsModule } from '../chains/chains.module';

import {
  ProtocolsController,
} from './controllers';
import { ProtocolsContractsCron } from './cron';
import { ProtocolsSourceDefiLlamaProvider } from './providers';
import {
  Protocol,
  ProtocolSchema,
  ProtocolsContract,
  ProtocolsContractSchema,
} from './schemas';
import {
  ProtocolsContractsService,
  ProtocolsService,
  ProtocolsSourceSyncService,
} from './services';

@Module({
  providers: [
    ProtocolsService,
    ProtocolsContractsService,
    ProtocolsSourceSyncService,
    ProtocolsSourceDefiLlamaProvider,
    ProtocolsContractsCron,
  ],
  controllers: [
    ProtocolsController,
  ],
  imports: [
    ChainsModule,
    MongooseModule.forFeature([
      {
        name: Protocol.name,
        schema: ProtocolSchema,
      },
      {
        name: ProtocolsContract.name,
        schema: ProtocolsContractSchema,
      },
    ]),
  ],
  exports: [
    ProtocolsService,
    ProtocolsContractsService,
    ProtocolsSourceSyncService,
    ProtocolsSourceDefiLlamaProvider,
    MongooseModule,
  ],
})
export class ProtocolsModule {}
