import {
  Injectable,
  Logger,
  LoggerService as LoggerServiceOrig,
} from '@nestjs/common';

@Injectable()
export class LoggerService extends Logger implements LoggerServiceOrig {
  override log({
    message,
    data,
  }: {
    message: string,
    data: Parameters<LoggerServiceOrig['log']>[1],
  }) {
    super.log(message, data);
  }

  override error({
    message,
    context,
    stack,
  }: {
    message: string,
    context?: string,
    stack?: string,
  }) {
    super.error(message, stack, context);
  }

  override warn(message: string) {
    super.warn(message);
  }

  override debug({
    message,
    context,
    stack,
  }: {
    message: string,
    context?: string,
    stack?: string,
  }) {
    super.debug(message, stack, context);
  }

  override verbose(message: string) {
    super.verbose(message);
  }
}
