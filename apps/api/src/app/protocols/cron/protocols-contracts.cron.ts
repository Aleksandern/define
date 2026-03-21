import {
  Injectable,
} from '@nestjs/common';
import {
  Cron,
  CronExpression,
  Timeout,
} from '@nestjs/schedule';

import { ProtocolsSourceSyncService } from '../services';

@Injectable()
export class ProtocolsContractsCron {
  constructor(
    private readonly syncService: ProtocolsSourceSyncService,
  ) {}

  @Timeout(1000)
  async startup() {
    await this.syncDaily();
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncDaily() {
    await this.syncService.syncAll({
      limitProtocols: 5,
    });
  }
}
