import {
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import {
  ApiErrorMessageTypesP,
  ApiErrrorT,
} from '@define/common/types';

export const httpExceptionBadRequest = (
  data: string | (
    Pick<ApiErrrorT, 'message'>
    & Partial<Pick<ApiErrrorT, 'messageType'>>
  ),
): never => {
  let errorMessage: ApiErrrorT = {
    statusCode: HttpStatus.BAD_REQUEST,
    message: 'Bad Request',
    messageType: ApiErrorMessageTypesP.BAD_REQUEST,
  };

  if (typeof data === 'string') {
    errorMessage.message = data;
  } else if (typeof data === 'object') {
    errorMessage = {
      ...errorMessage,
      ...data,
    };

    if (data.message) {
      errorMessage.message = data.message;
    }
  }

  throw new HttpException(errorMessage, HttpStatus.BAD_REQUEST);
};

export const httpExceptionNotFound = (data = 'not found') => {
  throw new HttpException(data, HttpStatus.NOT_FOUND);
};

export const httpExceptionConflict = (data: string): never => {
  const errorMessage: ApiErrrorT = {
    statusCode: HttpStatus.CONFLICT,
    message: data,
    messageType: ApiErrorMessageTypesP.CONFLICT,
  };

  throw new HttpException(errorMessage, HttpStatus.CONFLICT);
};
