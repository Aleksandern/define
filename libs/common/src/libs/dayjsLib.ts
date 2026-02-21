import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isToday from 'dayjs/plugin/isToday';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import 'dayjs/locale/en';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isToday);
dayjs.extend(utc);
dayjs.extend(timezone);

export {
  dayjs,
};
