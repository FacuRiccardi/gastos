import { describe, it, expect } from 'vitest';
import { DomainError } from '../../../../src/domain/shared/DomainError.js';

describe('DomainError', () => {
  it('has type "Domain"', () => {
    const error = new DomainError('something went wrong');
    expect(error.type).toBe('Domain');
  });

  it('carries the given message', () => {
    const error = new DomainError('something went wrong');
    expect(error.message).toBe('something went wrong');
  });

  it('is an instance of Error', () => {
    expect(new DomainError('x')).toBeInstanceOf(Error);
  });
});
