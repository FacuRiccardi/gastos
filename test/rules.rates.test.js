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

describe('exchangeRates', () => {
  it('the household saves and reads the rate of a month', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'exchangeRates/2026-11'), { rate: 1535 }));
    await assertSucceeds(setDoc(doc(db, 'exchangeRates/2026-11'), { rate: 1540.5 }));
    await assertSucceeds(getDoc(doc(db, 'exchangeRates/2026-11')));
  });

  it('rejects a bad month, a bad rate or extra fields', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'exchangeRates/2026-13'), { rate: 1535 }));
    await assertFails(setDoc(doc(db, 'exchangeRates/noviembre'), { rate: 1535 }));
    await assertFails(setDoc(doc(db, 'exchangeRates/2026-11'), { rate: 0 }));
    await assertFails(setDoc(doc(db, 'exchangeRates/2026-11'), { rate: '1535' }));
    await assertFails(setDoc(doc(db, 'exchangeRates/2026-11'), { rate: 1535, note: 'x' }));
  });

  it('denies everyone else', async () => {
    await assertFails(getDoc(doc(stranger(), 'exchangeRates/2026-11')));
    await assertFails(setDoc(doc(stranger(), 'exchangeRates/2026-11'), { rate: 1535 }));
  });
});
