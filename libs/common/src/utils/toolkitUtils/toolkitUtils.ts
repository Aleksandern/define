export * from 'es-toolkit';
export {
  every,
  forEach,
  get,
  includes,
  isArray,
  isEmpty,
  isNaN,
  isObject,
  isObjectLike,
  omit as omitCompat,
  size,
  some,
} from 'es-toolkit/compat';

export const isEmptyObject = (data: object | undefined | null): boolean => {
  if (
    (data === undefined)
    || (data === null)
  ) {
    return true;
  }

  return (Object.keys(data).length === 0);
};

export const isEmptyString = (data: string | undefined): boolean => {
  if (data === undefined) {
    return true;
  }

  return (data.length === 0);
};

export const isEmptyArray = (data: any[] | undefined): boolean => {
  if (data === undefined) {
    return true;
  }

  return (data.length === 0);
};

export const includesExact = <T extends (string | number | symbol)[], B extends string | number | symbol>(
  arr: T,
  value: B,
): boolean => {
  const res = arr.some((item) => item === value);

  return res;
};
