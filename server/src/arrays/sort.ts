export function descByCreationDate<T extends {createdAt: string}>(left: T, right: T): number {
  return -left.createdAt.localeCompare(right.createdAt);
}
