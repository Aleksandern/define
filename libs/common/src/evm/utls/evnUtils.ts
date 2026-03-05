import {
  Address,
  encodePacked,
  Hex,
} from 'viem';

export function topicAddress(addr: Address): Hex {
  // topic = 32-byte left-padded address
  const packed = encodePacked(['address'], [addr]);

  const res = `0x${packed.slice(2).padStart(64, '0')}`;

  return res as Hex;
}

export function toBlockHex(b: bigint): Hex {
  const res = `0x${b.toString(16)}`;

  return res as Hex;
}
