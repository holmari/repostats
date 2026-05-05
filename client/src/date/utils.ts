import {DateTime, DurationUnit} from 'luxon';
import {ComparisonIntervals, ComparisonMode, DateInterval} from 'types/types';

export function formatIsoDate(date: string | undefined) {
  if (!date || DateTime.fromISO(date).toMillis() === 0) {
    return 'Unknown';
  }

  return DateTime.fromISO(date).toFormat('yyyy-MM-dd');
}

export function formatIsoTime(datetime: string) {
  return DateTime.fromISO(datetime).toFormat('HH:mm');
}

export function formatIsoDateTime(datetime: string) {
  return `${formatIsoDate(datetime)} ${formatIsoTime(datetime)}`;
}

export function isAllTimeInterval(interval: DateInterval): boolean {
  return (
    DateTime.fromISO(interval.startDate).toMillis() === 0 &&
    DateTime.fromISO(interval.endDate).year > 2099
  );
}

export function formatInterval(interval: DateInterval) {
  const start = formatIsoDate(interval.startDate);
  const end = formatIsoDate(interval.endDate);
  const today = formatIsoDate(new Date().toISOString());

  if (DateTime.fromISO(interval.startDate).toMillis() === 0) {
    return end >= today ? 'All time' : `Up to ${end}`;
  } else if (DateTime.fromISO(interval.endDate).year > 2099) {
    return `from ${start} onwards`;
  }

  return `${start} to ${end}`;
}

function toDurationKey(unit: DurationUnit): 'hours' | 'days' | 'quarters' | 'years' {
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
    default:
      throw new Error(`Unsupported duration unit ${unit}`);
  }
}

export function getIntervalDuration(interval: DateInterval | null, unit: DurationUnit) {
  if (!interval) {
    return NaN;
  }

  const start = DateTime.fromISO(interval.startDate);
  const end = DateTime.fromISO(interval.endDate);
  return start.toMillis() === 0 || end.toMillis() === 0
    ? NaN
    : end.diff(start, unit)[toDurationKey(unit)] + 1;
}

export function getMaxDate(left: Date, right: Date): Date {
  return new Date(Math.max(left.getTime(), right.getTime()));
}

export function getMinDate(left: Date, right: Date): Date {
  return new Date(Math.min(left.getTime(), right.getTime()));
}

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

// (current, previous) slice intervals for a comparison mode.
// Mirrors server/src/date/utils.getComparisonIntervals.
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
