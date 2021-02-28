import {DateTime, DurationUnit} from 'luxon';
import {DateInterval} from 'types/types';

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
