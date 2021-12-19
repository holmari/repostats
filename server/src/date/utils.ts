import {DateTime, DurationUnit} from 'luxon';
import {DateInterval} from '../types/types';

export const EMPTY_INTERVAL: DateInterval = {
  startDate: new Date(0).toISOString(),
  endDate: new Date(0).toISOString(),
};

export const ALL_TIME_INTERVAL: DateInterval = {
  startDate: new Date(0).toISOString(),
  endDate: new Date('2100-01-01').toISOString(),
};

export function sliceDate(date: string): string {
  // Assuming a string like "2019-06-07T23:24:04Z", only keep the date, drop time
  return date.slice(0, 10);
}

export function singleDateInterval(date: string | null): DateInterval | null {
  return date ? {startDate: date, endDate: date} : null;
}

export function unionIntervals(
  left: DateInterval | null,
  right: DateInterval | null
): DateInterval | null {
  if (!left && !right) {
    return null;
  } else if (!left) {
    return right;
  } else if (!right) {
    return left;
  }

  const startDate = left.startDate < right.startDate ? left.startDate : right.startDate;
  const endDate = left.endDate > right.endDate ? left.endDate : right.endDate;
  return {startDate, endDate};
}

export function unionAllIntervals(intervals: ReadonlyArray<DateInterval>): DateInterval | null {
  return intervals.reduce<DateInterval | null>((acc, item) => unionIntervals(acc, item), null);
}

export function createInterval(...dates: ReadonlyArray<string | null>): DateInterval | null {
  if (!dates.length) {
    return null;
  }
  return dates
    .filter((date): date is string => Boolean(date))
    .reduce((resultInterval: DateInterval | null, date: string) => {
      if (!resultInterval) {
        return {startDate: date, endDate: date};
      }
      return {
        startDate: resultInterval.startDate < date ? resultInterval.startDate : date,
        endDate: resultInterval.endDate > date ? resultInterval.endDate : date,
      };
    }, null);
}

export function intersectIntervals(
  left: DateInterval | null,
  right: DateInterval | null
): DateInterval | null {
  if (!left && right) {
    return left;
  } else if (left && !right) {
    return right;
  } else if (left && right) {
    return {
      startDate: left.startDate < right.startDate ? right.startDate : left.startDate,
      endDate: left.endDate < right.endDate ? left.endDate : right.endDate,
    };
  }

  return null;
}

export function intersects(left: DateInterval | null, right: DateInterval | null): boolean {
  if (!left || !right) {
    return false;
  }

  const earlier = left.startDate < right.startDate ? left : right;
  const later = earlier === left ? right : left;

  return earlier.endDate >= later.startDate;
}

function toDurationKey(
  unit: DurationUnit
): 'milliseconds' | 'hours' | 'days' | 'quarters' | 'years' {
  switch (unit) {
    case 'day':
    case 'days':
      return 'days';
    case 'hour':
    case 'hours':
      return 'hours';
    case 'year':
    case 'years':
      return 'years';
    case 'quarter':
    case 'quarters':
      return 'quarters';
    case 'millisecond':
    case 'milliseconds':
      return 'milliseconds';
    default:
      throw new Error(`Unsupported duration unit ${unit}`);
  }
}

export function getIntervalDuration(interval: DateInterval | null, unit: DurationUnit): number {
  if (!interval) {
    return NaN;
  }

  const start = DateTime.fromISO(interval.startDate);
  const end = DateTime.fromISO(interval.endDate);
  return start.toMillis() === 0 || end.toMillis() === 0
    ? NaN
    : end.diff(start, unit)[toDurationKey(unit)];
}

export function* iterateInterval(interval: DateInterval | null): Generator<string, void, unknown> {
  if (!interval) {
    return;
  }

  const start = DateTime.fromISO(interval.startDate);
  const end = DateTime.fromISO(interval.endDate);
  let current = start;

  while (current <= end) {
    yield current.toISODate();
    current = current.plus({days: 1});
  }
}
