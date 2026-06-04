import { describe, it, expect } from 'vitest';
import { ApplicationError } from '../../../src/application/ApplicationError.js';

describe('ApplicationError', () => {
  it('has type "Application"', () => {
    const error = new ApplicationError('something went wrong');
    expect(error.type).toBe('Application');
  });

  it('carries the given message', () => {
    const error = new ApplicationError('something went wrong');
    expect(error.message).toBe('something went wrong');
  });

  it('is an instance of Error', () => {
    expect(new ApplicationError('x')).toBeInstanceOf(Error);
  });
});
