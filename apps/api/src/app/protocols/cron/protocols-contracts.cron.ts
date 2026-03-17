import {
  Injectable,
} from '@nestjs/common';
import {
  Cron,
  CronExpression,
  Timeout,
} from '@nestjs/schedule';

import { LoggerService } from '@appApi/services/logger.service';

import { ProtocolsSourceSyncService } from '../services';

@Injectable()
export class ProtocolsContractsCron {
  private readonly logger = new LoggerService(ProtocolsContractsCron.name);

  constructor(
    private readonly syncService: ProtocolsSourceSyncService,
  ) {}

  @Timeout(1000)
  async startup() {
    await this.syncDaily();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncDaily() {
    console.log('!!!STARTING DAILY SYNC', { });
    await this.syncService.syncAll({
      limitProtocols: 5,
    });
  }
}
