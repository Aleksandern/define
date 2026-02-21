export function forEachObj<T extends object>(
  obj: T,
  callback: (value: T[keyof T], key: keyof T) => void,
): void {
  (Object.keys(obj) as (keyof T)[]).forEach((key) => {
    const value = obj[key];
    callback(value, key);
  });
}
