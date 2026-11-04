// Authorizes (or revokes) a person to read the expenses in the web app by setting the custom claim
// `household` on their Firebase account. The person must have signed in to the app once so that
// the account exists. Emails are passed as arguments and never stored anywhere.
//
// Usage (from the project root; needs gcloud application default credentials):
//   GCP_PROJECT_ID=<project-id> node scripts/grant-access.js <email>
//   GCP_PROJECT_ID=<project-id> node scripts/grant-access.js --revoke <email>
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { lookupErrorMessage, parseArgs, withHousehold, withoutHousehold } from './lib/claims.js';

const { GCP_PROJECT_ID } = process.env;
if (!GCP_PROJECT_ID) {
  console.error('GCP_PROJECT_ID is missing from the environment.');
  process.exit(1);
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: GCP_PROJECT_ID });
const auth = getAuth();

let user;
try {
  user = await auth.getUserByEmail(args.email);
} catch (e) {
  console.error(lookupErrorMessage(e));
  process.exit(1);
}

if (args.revoke) {
  const claims = withoutHousehold(user.customClaims);
  await auth.setCustomUserClaims(user.uid, Object.keys(claims).length ? claims : null);
  await auth.revokeRefreshTokens(user.uid);
  console.log('Access revoked. Sessions cannot be refreshed any more, but a token that was already issued can keep working for up to one hour.');
} else {
  await auth.setCustomUserClaims(user.uid, withHousehold(user.customClaims));
  console.log('Access granted. The person has to press "check again" in the app (or sign in again) to get a token with the new claim.');
}
