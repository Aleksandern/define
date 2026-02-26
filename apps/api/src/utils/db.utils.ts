import {
  Types,
} from 'mongoose';

type ConvertObjectIdAndDateToString<T> = T extends Types.ObjectId | Date
  ? string
  : T extends (infer U)[]
    ? ConvertObjectIdAndDateToString<U>[]
    : T extends object
      ? { [K in keyof T]: ConvertObjectIdAndDateToString<T[K]> }
      : T;

export const dbUtils = {
  idToObjectId: (id: string | Types.ObjectId): Types.ObjectId => {
    const res = (typeof id === 'string') ? new Types.ObjectId(id) : id;

    return res;
  },

  idToObjectIdArr: (ids: (string | Types.ObjectId)[]): Types.ObjectId[] => {
    const res = ids.map((id) => dbUtils.idToObjectId(id));

    return res;
  },

  objectIdToString(id: string | Types.ObjectId): string {
    const res = (typeof id === 'string') ? id : id.toString();

    return res;
  },

  isObjectId(value: string) {
    const res = Types.ObjectId.isValid(value) && (new Types.ObjectId(value).toString() === value);

    return res;
  },

  likeQuery(query: Record<string, string>) {
    const keys = Object.keys(query);

    if (keys.length !== 1) {
      throw new Error('likeQuery function only accepts a single key-value pair.');
    }

    const [key, value] = Object.entries(query)[0];

    // Escape special regex characters
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const res = {
      [key]: {
        $regex: escapedValue,
        $options: 'i',
      },
    };

    return res;
  },

  /**
   * for aggregate document
   * for not aggregate documents use "toObject" first (doc.toObject())
   *
   * Recursively converts all ObjectId instances to strings and Date objects to ISO strings in an object/array.
   * @param obj - The object or array to transform.
   * @returns The transformed object with ObjectIds and Dates replaced by strings.
   *
   * TODO: refactor it
   */
  docToObject<T>(
    obj: T,
  ): ConvertObjectIdAndDateToString<T> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if ((obj as any).toObject) {
      throw new Error('Use "toObject" first');
    }

    if (Array.isArray(obj)) {
      // Handle arrays recursively
      return obj.map((item) => (
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        dbUtils.docToObject(item)
      )) as ConvertObjectIdAndDateToString<T>;
    }

    if (
      obj
      && (typeof obj === 'object')
      && (obj !== null)
    ) {
      if (obj instanceof Types.ObjectId) {
        return obj.toString() as ConvertObjectIdAndDateToString<T>;
      } if (obj instanceof Date) {
        return obj.toISOString() as ConvertObjectIdAndDateToString<T>;
      }

      const newObj: { [K in keyof T]?: ConvertObjectIdAndDateToString<T[K]> } = {};

      (Object.keys(obj) as (keyof T)[]).forEach((key) => {
        const value = obj[key];

        if (value instanceof Types.ObjectId) {
          newObj[key] = value.toString() as ConvertObjectIdAndDateToString<T[keyof T]>;
        } else if (value instanceof Date) {
          newObj[key] = value.toISOString() as ConvertObjectIdAndDateToString<T[keyof T]>;
        } else {
          newObj[key] = dbUtils.docToObject(value) as ConvertObjectIdAndDateToString<T[keyof T]>;
        }
      });

      return newObj as ConvertObjectIdAndDateToString<T>;
    }

    // Return the original value for primitive types
    return obj as ConvertObjectIdAndDateToString<T>;
  },
};
