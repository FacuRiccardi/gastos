import { describe, it, expect } from 'vitest';
import { Page } from '../../../../src/domain/shared/Page.js';
import { DomainError } from '../../../../src/domain/shared/DomainError.js';

describe('Page', () => {
  describe('valid construction', () => {
    it('constructs with items and a positive total', () => {
      const page = new Page(['a', 'b'], 10);
      expect(page.items).toEqual(['a', 'b']);
      expect(page.total).toBe(10);
    });

    it('constructs with an empty items array and total of zero', () => {
      const page = new Page([], 0);
      expect(page.items).toHaveLength(0);
      expect(page.total).toBe(0);
    });
  });

  describe('invariants', () => {
    it('rejects a negative total', () => {
      expect(() => new Page([], -1)).toThrow(DomainError);
    });

    it('rejects a fractional total', () => {
      expect(() => new Page([], 1.5)).toThrow(DomainError);
    });
  });
});
