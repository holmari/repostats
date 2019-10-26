export function replaceAt<T>(array: ReadonlyArray<T>, index: number, item: T) {
  if (index > array.length || index === -1) {
    return [...array, item];
  }
  return [...array.slice(0, index), item, ...array.slice(index + 1)];
}

export function replaceArrayValue<T>(arr: ReadonlyArray<T>, value: T, index: number) {
  return Object.assign([...arr], {[index]: value});
}

export function removeAt<T>(values: ReadonlyArray<T>, index: number): ReadonlyArray<T> {
  const result = [...values];
  result.splice(index, 1);
  return result;
}

export function toggleValue<T>(values: ReadonlyArray<T>, toToggle: T): ReadonlyArray<T> {
  const existingIndex = values.findIndex((v) => v === toToggle);
  return existingIndex === -1 ? [...values, toToggle] : removeAt(values, existingIndex);
}

export function removeDuplicates<T>(values: ReadonlyArray<T>): ReadonlyArray<T> {
  const valueSet = new Set(values);
  const result: Array<T> = [];

  valueSet.forEach((v) => result.push(v));

  return result;
}
