import { DomainError } from './DomainError.js';

export class Pagination {
  constructor(
    readonly limit: number,
    readonly offset: number,
  ) {
    if (!Number.isInteger(limit) || limit <= 0) throw new DomainError('Pagination limit must be a positive integer');
    if (!Number.isInteger(offset) || offset < 0) throw new DomainError('Pagination offset must be a non-negative integer');
  }
}
