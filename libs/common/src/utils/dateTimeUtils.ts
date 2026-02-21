import {
  dayjs,
} from '../libs';

export type DateTimeConfigT = dayjs.ConfigType;
export type DateTimeLibT = dayjs.Dayjs;

export const dateTimeUtils = {
  getLib(
    date?: dayjs.ConfigType,
    format?: dayjs.OptionType,
    strict?: boolean,
  ) {
    return dayjs(date, format, strict);
  },

  getLibTz(
    ...args: Parameters<typeof dayjs.tz>
  ) {
    return dayjs.tz(...args);
  },

  getLibUtcTz({
    date,
    tz,
  }: {
    date?: dayjs.ConfigType,
    tz: string,
  }) {
    const res = this.getLibNoCall().utc(date).tz(tz);

    return res;
  },

  getLibNoCall() {
    return dayjs;
  },
};
