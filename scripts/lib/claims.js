// Pure helpers for scripts/grant-access.js.
// Note: Firebase's setCustomUserClaims REPLACES all of a user's claims, so the script always
// reads the current claims and merges.

export function withHousehold(existing) {
  return { ...(existing ?? {}), household: true };
}

export function withoutHousehold(existing) {
  const { household: _removed, ...rest } = existing ?? {};
  return rest;
}

// Message for a failed user lookup. Only a missing account means "sign in once first"; any other
// error (credentials, quota project, permissions) is shown as it is so it does not mislead.
export function lookupErrorMessage(error) {
  if (error?.code === 'auth/user-not-found') {
    return 'No Firebase account found for that email. The person must sign in to the app once first.';
  }
  return `Could not look up the user: ${error?.code ?? ''} ${error?.message ?? error}`.replace('  ', ' ');
}

// argv: the arguments after the script name, e.g. ['--revoke', 'person@example.com']
export function parseArgs(argv) {
  let email;
  let revoke = false;
  for (const arg of argv) {
    if (arg === '--revoke') revoke = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else email = arg;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email is required. Usage: node scripts/grant-access.js [--revoke] <email>');
  }
  return { email, revoke };
}
