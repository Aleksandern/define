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

import { ChainsModule } from './chains/chains.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    LoggerService,
  ],
})
export class AppModule {}
