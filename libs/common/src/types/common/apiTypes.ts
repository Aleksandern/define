export enum ApiErrorMessageTypesP {
  BAD_REQUEST = 'BAD_REQUEST',
  CONFLICT = 'CONFLICT',
  NO_CARDS = 'NO_CARDS',
  NO_VALID_CARDS = 'NO_VALID_CARDS',
}

export interface ApiErrrorMessageT {
  message: string,
  messageType: ApiErrorMessageTypesP,
}

export interface ApiErrrorT extends ApiErrrorMessageT {
  statusCode: number,
}

type ExactMatchT<T, U extends T> = {
  [K in keyof T]: K extends keyof U ? U[K] : never;
};

interface ApiSchemaBaseT {
  BASE: unknown,
  DTO: unknown,
  FORM?: unknown,
  FORM_INIT?: unknown,
  RETURN: unknown,
  RETURN_SRV: unknown,
}

interface ApiSchemaFormBaseT extends ApiSchemaBaseT {
  FORM: unknown,
  FORM_INIT: unknown,
}

interface ApiSchemaFilesBaseT extends ApiSchemaBaseT {
  FILES_UPL: unknown,
  FILES_UPL_SRV: unknown,
  FILES_KEYS: unknown,
}

type ApiSchemaFormFilesBaseT = ApiSchemaFormBaseT & ApiSchemaFilesBaseT;

export type ApiSchemaT<T extends ApiSchemaBaseT> = ExactMatchT<ApiSchemaBaseT, T>;
export type ApiSchemaFormT<T extends ApiSchemaFormBaseT> = ExactMatchT<ApiSchemaFormBaseT, T>;
export type ApiSchemaFilesT<T extends ApiSchemaFilesBaseT> = ExactMatchT<ApiSchemaFilesBaseT, T>;
export type ApiSchemaFormFilesT<T extends ApiSchemaFormFilesBaseT> = ExactMatchT<ApiSchemaFormFilesBaseT, T>;
