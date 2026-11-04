import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

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
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'incomes/i1'), { amount: 1000, currency: 'ARS', date: '2026-11-01', owner: 'Ana' });
    await setDoc(doc(ctx.firestore(), 'savings/s1'), { amount: 50, currency: 'USD', date: '2026-11-02' });
  });
});

const household = () =>
  testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true }).firestore();
const stranger = () => testEnv.authenticatedContext('u2', { email_verified: true }).firestore();

// Incomes carry the owner; savings do not.
const base = (collection) => (collection === 'incomes' ? { owner: 'Beto' } : {});

describe.each(['incomes', 'savings'])('%s', (collection) => {
  it('the household reads, creates and deletes valid entries', async () => {
    const db = household();
    await assertSucceeds(getDoc(doc(db, `${collection}/${collection === 'incomes' ? 'i1' : 's1'}`)));
    await assertSucceeds(setDoc(doc(db, `${collection}/new`), { amount: 1500.5, currency: 'USD', date: '2026-11-03', ...base(collection) }));
    await assertSucceeds(deleteDoc(doc(db, `${collection}/new`)));
  });

  it('rejects invalid entries', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, `${collection}/x`), { amount: 0, currency: 'ARS', date: '2026-11-03', ...base(collection) }));
    await assertFails(setDoc(doc(db, `${collection}/x`), { amount: -5, currency: 'ARS', date: '2026-11-03', ...base(collection) }));
    await assertFails(setDoc(doc(db, `${collection}/x`), { amount: '5', currency: 'ARS', date: '2026-11-03', ...base(collection) }));
    await assertFails(setDoc(doc(db, `${collection}/x`), { amount: 5, currency: 'EUR', date: '2026-11-03', ...base(collection) }));
    await assertFails(setDoc(doc(db, `${collection}/x`), { amount: 5, currency: 'ARS', date: '03/11/2026', ...base(collection) }));
    await assertFails(setDoc(doc(db, `${collection}/x`), { amount: 5, currency: 'ARS', date: '2026-11-03', note: 'x', ...base(collection) }));
    await assertFails(setDoc(doc(db, `${collection}/x`), { amount: 5, currency: 'ARS' }));
  });

  it('denies everyone else', async () => {
    await assertFails(getDoc(doc(stranger(), `${collection}/x`)));
    await assertFails(setDoc(doc(stranger(), `${collection}/x`), { amount: 5, currency: 'ARS', date: '2026-11-03', ...base(collection) }));
  });
});

describe('income owner', () => {
  it('requires the owner: a text of 1 to 40 characters', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'incomes/x'), { amount: 5, currency: 'ARS', date: '2026-11-03' }));
    await assertFails(setDoc(doc(db, 'incomes/x'), { amount: 5, currency: 'ARS', date: '2026-11-03', owner: '' }));
    await assertFails(setDoc(doc(db, 'incomes/x'), { amount: 5, currency: 'ARS', date: '2026-11-03', owner: 'a'.repeat(41) }));
    await assertFails(setDoc(doc(db, 'incomes/x'), { amount: 5, currency: 'ARS', date: '2026-11-03', owner: 7 }));
    await assertSucceeds(setDoc(doc(db, 'incomes/x'), { amount: 5, currency: 'ARS', date: '2026-11-03', owner: 'Ana' }));
  });

  it('savings do not take an owner', async () => {
    await assertFails(setDoc(doc(household(), 'savings/x'), { amount: 5, currency: 'ARS', date: '2026-11-03', owner: 'Ana' }));
  });
});
