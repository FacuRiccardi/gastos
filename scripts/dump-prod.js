// Copies the production data into emulator-data/ (git-ignored) so the local emulator can be loaded
// with it (scripts/seed-emulator.js). READ-ONLY: it only reads Firestore and lists Auth users.
//
// Usage (from the project root; needs gcloud application default credentials):
//   GCP_PROJECT_ID=<project-id> node scripts/dump-prod.js
import { mkdirSync, writeFileSync } from 'node:fs';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS, encode } from './lib/dumpFormat.js';

const { GCP_PROJECT_ID } = process.env;
if (!GCP_PROJECT_ID) {
  console.error('GCP_PROJECT_ID is missing from the environment.');
  process.exit(1);
}
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.error('An emulator host is set: unset it so this reads production.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault(), projectId: GCP_PROJECT_ID });
const db = getFirestore();
const dir = 'emulator-data';
mkdirSync(dir, { recursive: true });

const data = {};
for (const name of COLLECTIONS) {
  const snap = await db.collection(name).get();
  data[name] = snap.docs.map((d) => ({ id: d.id, data: encode(d.data()) }));
  console.log(`${name}: ${snap.size}`);
}
writeFileSync(`${dir}/firestore.json`, JSON.stringify(data, null, 2));

// Only the people with the `household` claim; no passwords or tokens are exported.
const users = [];
let pageToken;
do {
  const page = await getAuth().listUsers(1000, pageToken);
  for (const u of page.users) {
    if (u.customClaims?.household === true && u.email) {
      users.push({ email: u.email, displayName: u.displayName ?? null });
    }
  }
  pageToken = page.pageToken;
} while (pageToken);
writeFileSync(`${dir}/auth.json`, JSON.stringify(users, null, 2));
console.log(`household users: ${users.length}`);
console.log(`Written to ${dir}/`);
