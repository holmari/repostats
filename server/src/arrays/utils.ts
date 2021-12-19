import {uniq} from 'lodash';

// Note: this assumees reference equality for objects
export function removeDuplicates<T>(data: ReadonlyArray<T>): ReadonlyArray<T> {
  return uniq(data);
}
