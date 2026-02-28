import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';

import { AddressFindOneT } from '@define/common/types';

import { AddressFindOneDto } from '../dto';
import { AddressService } from '../services';

@Controller('address')
export class AddressController {
  constructor(
    private readonly addressService: AddressService,
  ) {
    // empty
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query() query: AddressFindOneDto,
  ): Promise<AddressFindOneT['RETURN_SRV']> {
    const res = await this.addressService.findOne({
      idWallet: id,
      query,
    });

    return res;
  }
}
