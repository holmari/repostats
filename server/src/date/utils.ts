import {DateTime, DurationUnit} from 'luxon';
import {ComparisonIntervals, ComparisonMode, DateInterval, Granularity} from '../types/types';

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

export function getPeriodStartDate(dateStr: string, granularity: Granularity): string {
  const dt = DateTime.fromISO(dateStr);
  switch (granularity) {
    case 'day':
      return dateStr.slice(0, 10);
    case 'week':
      return dt.startOf('week').toISODate()!;
    case 'month':
      return dt.startOf('month').toISODate()!;
    case 'quarter':
      return dt.startOf('quarter').toISODate()!;
    case 'year':
      return dt.startOf('year').toISODate()!;
  }
}

// Calendar-aligned "last full quarter" relative to a reference date.
// The current quarter is never considered "full" until its successor begins, so
// the last full quarter is always the one immediately preceding referenceDate's
// quarter.
function getLastFullQuarter(referenceDate: DateTime): {start: DateTime; end: DateTime} {
  const currentQuarterStart = referenceDate.startOf('quarter');
  const start = currentQuarterStart.minus({months: 3});
  const end = currentQuarterStart.minus({days: 1});
  return {start, end};
}

function getLastFullYear(referenceDate: DateTime): {start: DateTime; end: DateTime} {
  const currentYearStart = referenceDate.startOf('year');
  const start = currentYearStart.minus({years: 1});
  const end = currentYearStart.minus({days: 1});
  return {start, end};
}

function asInterval(start: DateTime, end: DateTime): DateInterval {
  return {startDate: start.toISODate()!, endDate: end.toISODate()!};
}

// Compute the (current, previous) slice intervals for a comparison mode.
// Calendar-aligned modes (qoq/qyoy/yoy) ignore the eval interval and anchor to
// referenceDate. PoP uses the eval interval as its current slice and shifts it
// back by an equal number of days for the previous slice.
export function getComparisonIntervals(
  referenceDate: DateTime,
  mode: ComparisonMode,
  evalInterval: DateInterval
): ComparisonIntervals {
  switch (mode) {
    case 'qoq': {
      const last = getLastFullQuarter(referenceDate);
      const prevStart = last.start.minus({months: 3});
      const prevEnd = last.start.minus({days: 1});
      return {
        current: asInterval(last.start, last.end),
        previous: asInterval(prevStart, prevEnd),
      };
    }
    case 'qyoy': {
      const last = getLastFullQuarter(referenceDate);
      const prevStart = last.start.minus({years: 1});
      const prevEnd = last.end.minus({years: 1});
      return {
        current: asInterval(last.start, last.end),
        previous: asInterval(prevStart, prevEnd),
      };
    }
    case 'yoy': {
      const last = getLastFullYear(referenceDate);
      const prevStart = last.start.minus({years: 1});
      const prevEnd = last.start.minus({days: 1});
      return {
        current: asInterval(last.start, last.end),
        previous: asInterval(prevStart, prevEnd),
      };
    }
    case 'pop': {
      const start = DateTime.fromISO(evalInterval.startDate);
      const end = DateTime.fromISO(evalInterval.endDate);
      const lengthDays = Math.round(end.diff(start, 'days').days);
      const prevEnd = start.minus({days: 1});
      const prevStart = prevEnd.minus({days: lengthDays});
      return {
        current: asInterval(start, end),
        previous: asInterval(prevStart, prevEnd),
      };
    }
  }
}
