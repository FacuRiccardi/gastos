// Converts the old collections into month documents (months/*, config/*, meta/uncategorized).
// Re-runnable: every document is overwritten with the same result, so a failed run can simply be
// run again. The old collections are only read.
//
// Usage (from the project root):
//   emulator: FIRESTORE_EMULATOR_HOST=localhost:8080 npm run migrate
//   production (gcloud application default credentials): GCP_PROJECT_ID=<project-id> npm run migrate
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { OLD_COLLECTIONS } from './lib/dumpFormat.js';
import { migrate } from './lib/migration.js';

const { GCP_PROJECT_ID, FIRESTORE_EMULATOR_HOST } = process.env;
if (FIRESTORE_EMULATOR_HOST && GCP_PROJECT_ID) {
  console.error('Both FIRESTORE_EMULATOR_HOST and GCP_PROJECT_ID are set: unset one to choose emulator or production.');
  process.exit(1);
}
if (FIRESTORE_EMULATOR_HOST) {
  initializeApp({ projectId: 'demo-gastos' });
  console.log(`Target: EMULATOR ${FIRESTORE_EMULATOR_HOST} (project demo-gastos)`);
} else if (GCP_PROJECT_ID) {
  initializeApp({ credential: applicationDefault(), projectId: GCP_PROJECT_ID });
  console.log(`Target: PRODUCTION project ${GCP_PROJECT_ID}`);
} else {
  console.error('GCP_PROJECT_ID is missing from the environment (or set FIRESTORE_EMULATOR_HOST).');
  process.exit(1);
}
const db = getFirestore();

const collections = {};
for (const name of OLD_COLLECTIONS) {
  const snap = await db.collection(name).get();
  collections[name] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

const { months, config, uncategorized, counts } = migrate(collections);

const writes = [
  ...Object.entries(months).map(([id, data]) => [db.collection('months').doc(id), data]),
  ...Object.entries(config).map(([id, data]) => [db.collection('config').doc(id), data]),
  [db.collection('meta').doc('uncategorized'), uncategorized],
];
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const [ref, data] of writes.slice(i, i + 400)) batch.set(ref, data);
  await batch.commit();
}

console.log(JSON.stringify(counts, null, 2));
console.log(`Wrote ${writes.length} documents.`);
