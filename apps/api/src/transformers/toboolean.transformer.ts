import { Transform } from 'class-transformer';

const valueToBoolean = (value: string | boolean) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (['true', 'on', 'yes', '1'].includes(value.toLowerCase())) {
    return true;
  }

  if (['false', 'off', 'no', '0'].includes(value.toLowerCase())) {
    return false;
  }

  return undefined;
};

export const ToBoolean = () => {
  const toPlain = Transform(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    ({ value }) => value,
    {
      toPlainOnly: true,
    },
  );

  const toClass = (target: any, key: string) => Transform(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    ({ obj }) => valueToBoolean(obj[key]),
    {
      toClassOnly: true,
    },
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  )(target, key);

  return (target: any, key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    toPlain(target, key);
    toClass(target, key);
  };
};
