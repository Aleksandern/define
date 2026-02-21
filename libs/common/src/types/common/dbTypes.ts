export type DbItemUpdateT<T> = T & {
  $unset?: Partial<Record<keyof T, ''>>,
  $set?: Partial<T>,
};
