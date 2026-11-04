import { describe, it, expect } from 'vitest';
import { withHousehold, withoutHousehold, parseArgs, lookupErrorMessage } from '../scripts/lib/claims.js';

describe('withHousehold', () => {
  it('keeps the other claims', () => {
    expect(withHousehold({ admin: true })).toEqual({ admin: true, household: true });
  });

  it('works when the user has no claims yet', () => {
    expect(withHousehold(undefined)).toEqual({ household: true });
  });

  it('does not mutate its input', () => {
    const claims = { admin: true };
    withHousehold(claims);
    expect(claims).toEqual({ admin: true });
  });
});

describe('withoutHousehold', () => {
  it('removes only the household claim', () => {
    expect(withoutHousehold({ admin: true, household: true })).toEqual({ admin: true });
  });

  it('works when the user has no claims', () => {
    expect(withoutHousehold(undefined)).toEqual({});
  });
});

describe('parseArgs', () => {
  it('reads an email', () => {
    expect(parseArgs(['person@example.com'])).toEqual({ email: 'person@example.com', revoke: false });
  });

  it('reads --revoke before or after the email', () => {
    expect(parseArgs(['--revoke', 'person@example.com'])).toEqual({ email: 'person@example.com', revoke: true });
    expect(parseArgs(['person@example.com', '--revoke'])).toEqual({ email: 'person@example.com', revoke: true });
  });

  it('throws when the email is missing or invalid', () => {
    expect(() => parseArgs([])).toThrow(/email/i);
    expect(() => parseArgs(['--revoke'])).toThrow(/email/i);
    expect(() => parseArgs(['not-an-email'])).toThrow(/email/i);
  });

  it('throws on an unknown flag', () => {
    expect(() => parseArgs(['--grant', 'person@example.com'])).toThrow(/unknown/i);
  });
});

describe('lookupErrorMessage', () => {
  it('explains that the person must sign in once when the account does not exist', () => {
    expect(lookupErrorMessage({ code: 'auth/user-not-found', message: 'x' })).toMatch(/sign in to the app once/i);
  });

  it('does not blame a missing account for other errors, and keeps the real cause', () => {
    const text = lookupErrorMessage({ code: 'app/invalid-credential', message: 'Could not load the default credentials' });
    expect(text).not.toMatch(/sign in to the app once/i);
    expect(text).toContain('Could not load the default credentials');
  });
});
