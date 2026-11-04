import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';

let testEnv;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with `npm run test:rules` (Firestore emulator)');
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-expenses',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const household = () =>
  testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true }).firestore();
const stranger = () => testEnv.authenticatedContext('u2', { email_verified: true }).firestore();

describe('spendingCaps', () => {
  it('the household saves and reads the cap of a month', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'spendingCaps/2026-11'), { amount: 2500000 }));
    await assertSucceeds(setDoc(doc(db, 'spendingCaps/2026-11'), { amount: 2700000.5 }));
    await assertSucceeds(getDoc(doc(db, 'spendingCaps/2026-11')));
  });

  it('rejects a bad month, a bad amount or extra fields', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'spendingCaps/2026-13'), { amount: 1 }));
    await assertFails(setDoc(doc(db, 'spendingCaps/noviembre'), { amount: 1 }));
    await assertFails(setDoc(doc(db, 'spendingCaps/2026-11'), { amount: 0 }));
    await assertFails(setDoc(doc(db, 'spendingCaps/2026-11'), { amount: '5' }));
    await assertFails(setDoc(doc(db, 'spendingCaps/2026-11'), { amount: 5, note: 'x' }));
  });

  it('denies everyone else', async () => {
    await assertFails(getDoc(doc(stranger(), 'spendingCaps/2026-11')));
    await assertFails(setDoc(doc(stranger(), 'spendingCaps/2026-11'), { amount: 5 }));
  });
});
