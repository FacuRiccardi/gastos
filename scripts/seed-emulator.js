// Loads emulator-data/ (made by scripts/dump-prod.js) into the LOCAL emulators and creates the
// household users there. It refuses to run against anything but localhost.
//
// Usage: start the emulators (npm run dev:emulators) and, in another terminal, `npm run dev:seed`.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS, decode } from './lib/dumpFormat.js';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
for (const host of [process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_AUTH_EMULATOR_HOST]) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host)) {
    console.error(`Refusing to seed ${host}: only localhost emulators are allowed.`);
    process.exit(1);
  }
}

initializeApp({ projectId: 'demo-gastos' });
const db = getFirestore();
const data = JSON.parse(readFileSync('emulator-data/firestore.json', 'utf8'));

// Start from a clean slate so running the seed twice does not leave stale documents.
for (const name of COLLECTIONS) {
  await db.recursiveDelete(db.collection(name));
}
for (const name of COLLECTIONS) {
  const docs = data[name] ?? [];
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + 400)) batch.set(db.collection(name).doc(d.id), decode(d.data));
    await batch.commit();
  }
  console.log(`${name}: ${docs.length}`);
}

// One cap alert for the current month so the home banner can be seen locally.
const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit' }).format(new Date());
await db.recursiveDelete(db.collection('capAlerts'));
await db.collection('capAlerts').doc(month).set({ month, lastLevel: 50, total: 1000000, cap: 2000000 });
console.log(`capAlerts: ${month} (level 50)`);

const auth = getAuth();
for (const u of JSON.parse(readFileSync('emulator-data/auth.json', 'utf8'))) {
  let user;
  try {
    user = await auth.getUserByEmail(u.email);
  } catch {
    user = await auth.createUser({ email: u.email, emailVerified: true, displayName: u.displayName ?? undefined });
  }
  await auth.setCustomUserClaims(user.uid, { household: true });
  console.log(`user ${u.email} (household)`);
}
console.log('Done.');
