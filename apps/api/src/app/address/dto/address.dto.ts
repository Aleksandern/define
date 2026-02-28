import {
  IsBoolean,
  IsOptional,
} from 'class-validator';

import {
  AddressFindOneT,
  ExactMatchDtoT,
} from '@define/common/types';

import { ToBoolean } from '@appApi/transformers';

// find one START
type AddressFindOneDtoT = AddressFindOneT['DTO'];
export class AddressFindOneDto implements AddressFindOneDtoT {
  @IsOptional()
  @IsBoolean()
  @ToBoolean()
  hasList: AddressFindOneDtoT['hasList'];
}
export const AddressFindOneDtoMatch: ExactMatchDtoT<
  AddressFindOneDto,
  AddressFindOneDtoT
> = new AddressFindOneDto();
// find one END
