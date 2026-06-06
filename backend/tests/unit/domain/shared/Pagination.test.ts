import { describe, it, expect } from 'vitest';
import { Pagination } from '../../../../src/domain/shared/Pagination.js';
import { DomainError } from '../../../../src/domain/shared/DomainError.js';

describe('Pagination', () => {
  describe('valid construction', () => {
    it('constructs with a positive limit and zero offset', () => {
      const p = new Pagination(10, 0);
      expect(p.limit).toBe(10);
      expect(p.offset).toBe(0);
    });

    it('constructs with a positive limit and positive offset', () => {
      const p = new Pagination(20, 40);
      expect(p.limit).toBe(20);
      expect(p.offset).toBe(40);
    });
  });

  describe('invariants', () => {
    it('rejects a zero limit', () => {
      expect(() => new Pagination(0, 0)).toThrow(DomainError);
    });

    it('rejects a negative limit', () => {
      expect(() => new Pagination(-1, 0)).toThrow(DomainError);
    });

    it('rejects a fractional limit', () => {
      expect(() => new Pagination(1.5, 0)).toThrow(DomainError);
    });

    it('rejects a negative offset', () => {
      expect(() => new Pagination(10, -1)).toThrow(DomainError);
    });

    it('rejects a fractional offset', () => {
      expect(() => new Pagination(10, 0.5)).toThrow(DomainError);
    });
  });
});
