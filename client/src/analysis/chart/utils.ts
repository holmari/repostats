import {DateValue, Margins, Size} from './types';

export const DEFAULT_SIZE: Size = {
  width: 1050,
  height: 500,
};

export const DEFAULT_MARGINS: Margins = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 60,
};

export function accumulate(series: ReadonlyArray<DateValue>): ReadonlyArray<DateValue> {
  const result: DateValue[] = [];
  series.forEach((item, index) => {
    result.push({date: item.date, value: (result[index - 1]?.value || 0) + item.value});
  });
  return result;
}
