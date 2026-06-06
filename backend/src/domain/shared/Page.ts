import { DomainError } from './DomainError.js';

export class Page<T> {
  constructor(
    readonly items: T[],
    readonly total: number,
  ) {
    if (!Number.isInteger(total) || total < 0) throw new DomainError('Page total must be a non-negative integer');
  }
}
