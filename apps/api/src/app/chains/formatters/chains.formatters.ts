import {
  ChainSrvT,
} from '@define/common/types';

export const ChainItemFormat = (data: ChainSrvT) => {
  const res = data;

  return res;
};

export const ChainItemsFormat = (data: ChainSrvT[]) => {
  const res = data.map((item) => ChainItemFormat(item));

  return res;
};
