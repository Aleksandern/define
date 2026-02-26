import {
  Controller,
  Get,
} from '@nestjs/common';

import { ChainsRpcsService } from '../services';

@Controller('chains-rpcs')
export class ChainsRpcsController {
  constructor(
    private readonly chainsRpcsService: ChainsRpcsService,
  ) {}

  @Get()
  findAll() {
    return this.chainsRpcsService.getBestRpcs({
      // chainIdOrig: 1,
      chainId: '699fe5b3ec1bf5fa35c48ab2',
      limit: 10,
    });
  }
}
