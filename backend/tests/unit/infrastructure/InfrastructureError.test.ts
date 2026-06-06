import { describe, it, expect } from 'vitest';
import { InfrastructureError } from '../../../src/infrastructure/InfrastructureError.js';

describe('InfrastructureError', () => {
  it('has type "Infrastructure"', () => {
    const error = new InfrastructureError('something went wrong');
    expect(error.type).toBe('Infrastructure');
  });

  it('carries the given message', () => {
    const error = new InfrastructureError('something went wrong');
    expect(error.message).toBe('something went wrong');
  });

  it('is an instance of Error', () => {
    expect(new InfrastructureError('x')).toBeInstanceOf(Error);
  });
});
