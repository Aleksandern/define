import {
  ProtocolSrvT,
} from '@define/common/types';

export const protocolItemFormat = (data: ProtocolSrvT) => {
  const res = data;

  return res;
};

export const protocolItemsFormat = (data: ProtocolSrvT[]) => {
  const res = data.map((item) => protocolItemFormat(item));

  return res;
};
