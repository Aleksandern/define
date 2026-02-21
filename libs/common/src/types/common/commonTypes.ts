// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type VerifyExtends<T, U extends T> = true;

/**
 * example usage:
 * export const PaginationDtoMatch: ExactMatchDtoT<PaginationDto, PaginationParamsDtoT> = new PaginationDto();
 *
 * if your class exteds:
 * export const PaginationDtoMatch: ExactMatchDtoT<PaginationDto, PaginationParamsDtoT, PaginationExtendedClassDto> = new PaginationDto();
 */
// eslint-disable-next-line @typescript-eslint/no-restricted-types
type OmitBaseClass<T, U> = Omit<T, keyof U>;
export type ExactMatchDtoT<T, U, Base = object> = OmitBaseClass<T, Base> extends U
  ? OmitBaseClass<U, Base> extends OmitBaseClass<T, Base>
    ? T
    : never
  : never;

export type OmitStrict<T, K extends keyof T> = T extends any ? Pick<T, Exclude<keyof T, K>> : never;

export type ExtractStrict<T, U extends T> = Extract<T, U>;

export type ExcludeStrict<T, U extends T> = Exclude<T, U>;

// https://stackoverflow.com/a/68686950/7456107
export function validateInterfaceMatchesEnum<
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _T extends Record<Enum, unknown>,
  Enum extends string | number,
>(): void {
  // empty
}

// https://stackoverflow.com/a/53229567/7456107
type Without<T, U> = Partial<Record<Exclude<keyof T, keyof U>, never>>;
export type XOR<T, U> = (T | U) extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;

export interface CoordinatesT {
  longitude: number,
  latitude: number,
}

export type CoordinatesArrT = [
  longitude: number,
  latitude: number,
];

export interface CoordinatesPoint {
  type: 'Point',
  coordinates: CoordinatesArrT,
}

export interface DataDevT {
  apiIp: string,
}

export interface ItemBaseT {
  _id: string,
  [key: string]: any,
}

export type ItemBaseGroupedT = ItemBaseT | string;

export interface ItemBaseTwoT {
  _id: string,
  createdAt: string,
  [key: string]: any,
}

export interface SectionItemT<T> {
  title: string,
  data: T[],
}

export type ExtractAndAddUndefT<T, K extends keyof T> = {
  [P in keyof T as P extends K ? P : never]: T[P] | undefined;
};

/**
 * It doesn't work with optional properties
 * TODO: fix it
 * https://github.com/sindresorhus/type-fest
 * https://github.com/ts-essentials/ts-essentials?tab=readme-ov-file
 */
export type AddUndefT<T, K extends keyof T> = {
  [P in keyof T]: P extends K ? (T[P] | undefined) : T[P];
};

export type MakeOptional<T, K extends keyof T> = OmitStrict<T, K> & Partial<Pick<T, K>>;

// https://stackoverflow.com/a/66680470/7456107
export type RequireKeys<T extends object, K extends keyof T> = (
  // eslint-disable-next-line @typescript-eslint/no-restricted-types
  (Required<Pick<T, K>> & Omit<T, K>) extends
  infer O ? { [P in keyof O]: O[P] } : never
);

export type ValueOfT<T> = T[keyof T];

// https://stackoverflow.com/a/78561950/7456107
export type UndefinableToOptionalT<T> = (
    { [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined> }
    & { [K in keyof T as undefined extends T[K] ? never : K]: T[K] }
);

export type DeepPartialT<T> = T extends object ? {
  [K in keyof T]?: DeepPartialT<T[K]>;
} : T;
