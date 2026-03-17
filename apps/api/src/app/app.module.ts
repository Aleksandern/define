import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { configEnv } from '../environments';
import { LoggerService } from '../services';
import { EnvironmentT } from '../types';

import { AddressModule } from './address/address.module';
import { ChainsModule } from './chains/chains.module';
import { ProtocolsModule } from './protocols/protocols.module';
import { RpcModule } from './rpc/rpc.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const environment = process.env.NODE_ENV ?? 'development';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${environment}`,
      ignoreEnvFile: (environment === 'production'),
      load: [configEnv],
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (cfg: ConfigService<EnvironmentT>) => ({
        uri: cfg.get('database.mongoUri', { infer: true }),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ChainsModule,
    AddressModule,
    RpcModule,
    ProtocolsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
  ],
})
export class AppModule {}
