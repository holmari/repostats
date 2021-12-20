import {uniq} from 'lodash';

// Note: this assumes reference equality for objects
export function removeDuplicates<T>(data: ReadonlyArray<T>): ReadonlyArray<T> {
  return uniq(data);
}
