import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';

import { AddressFindOneT } from '@define/common/types';

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
  ): Promise<AddressFindOneT['RETURN_SRV']> {
    const res = await this.addressService.findOne({
      idWallet: id,
    });

    return res;
  }
}
