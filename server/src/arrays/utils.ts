import {uniq} from 'lodash';

export function* mapIterator<T>(
  iterable: Iterable<T>,
  mapper: <K>(value: T) => K
): Generator<T, void, unknown> {
  for (const item of iterable) {
    yield mapper(item);
  }
}

// Note: this assumees reference equality for objects
export function removeDuplicates<T>(data: ReadonlyArray<T>): ReadonlyArray<T> {
  return uniq(data);
}
