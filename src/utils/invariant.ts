export function invariant<T>(
  item: T,
  message: string,
): asserts item is NonNullable<T> {
  if (!item) {
    throw new Error(message);
  }
}
