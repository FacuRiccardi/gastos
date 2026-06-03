export class Page<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
  ) {
    if (!Number.isInteger(total) || total < 0) throw new Error('Page total must be a non-negative integer');
  }
}
