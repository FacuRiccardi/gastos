import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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
    await setDoc(doc(ctx.firestore(), 'fixedTypes/t1'), { name: 'Alquiler' });
    await setDoc(doc(ctx.firestore(), 'fixedExpenses/t1_2026-11'), { typeId: 't1', month: '2026-11', amount: 900000 });
  });
});

const household = () =>
  testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true }).firestore();
const stranger = () => testEnv.authenticatedContext('u2', { email_verified: true }).firestore();

describe('fixedTypes', () => {
  it('the household reads, creates and renames types', async () => {
    const db = household();
    await assertSucceeds(getDoc(doc(db, 'fixedTypes/t1')));
    await assertSucceeds(setDoc(doc(db, 'fixedTypes/t2'), { name: 'Expensas' }));
    await assertSucceeds(updateDoc(doc(db, 'fixedTypes/t2'), { name: 'Expensas comunes' }));
  });

  it('a type is never deleted: it is disabled and enabled again', async () => {
    const db = household();
    await assertFails(deleteDoc(doc(db, 'fixedTypes/t1')));
    await assertSucceeds(updateDoc(doc(db, 'fixedTypes/t1'), { disabled: true }));
    await assertSucceeds(updateDoc(doc(db, 'fixedTypes/t1'), { disabled: false }));
    await assertFails(updateDoc(doc(db, 'fixedTypes/t1'), { disabled: 'yes' }));
  });

  it('rejects invalid types and everyone else', async () => {
    await assertFails(setDoc(doc(household(), 'fixedTypes/x'), { name: '' }));
    await assertFails(setDoc(doc(household(), 'fixedTypes/x'), { name: 'a'.repeat(41) }));
    await assertFails(setDoc(doc(household(), 'fixedTypes/x'), { name: 'X', extra: 1 }));
    await assertFails(setDoc(doc(stranger(), 'fixedTypes/x'), { name: 'X' }));
  });
});

describe('fixedExpenses', () => {
  it('the household loads, replaces and removes the amount of a month', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'fixedExpenses/t1_2026-12'), { typeId: 't1', month: '2026-12', amount: 950000.5 }));
    await assertSucceeds(setDoc(doc(db, 'fixedExpenses/t1_2026-11'), { typeId: 't1', month: '2026-11', amount: 1 }));
    await assertSucceeds(deleteDoc(doc(db, 'fixedExpenses/t1_2026-11')));
  });

  it('the ID must be typeId_month, so a type has one entry per month', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'fixedExpenses/otro'), { typeId: 't1', month: '2026-12', amount: 5 }));
    await assertFails(setDoc(doc(db, 'fixedExpenses/t1_2026-13'), { typeId: 't1', month: '2026-13', amount: 5 }));
  });

  it('rejects unknown types, bad amounts and extra fields', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'fixedExpenses/nope_2026-12'), { typeId: 'nope', month: '2026-12', amount: 5 }));
    await assertFails(setDoc(doc(db, 'fixedExpenses/t1_2026-12'), { typeId: 't1', month: '2026-12', amount: 0 }));
    await assertFails(setDoc(doc(db, 'fixedExpenses/t1_2026-12'), { typeId: 't1', month: '2026-12', amount: '5' }));
    await assertFails(setDoc(doc(db, 'fixedExpenses/t1_2026-12'), { typeId: 't1', month: '2026-12', amount: 5, note: 'x' }));
  });

  it('nothing new can be loaded for a disabled type, but its history stays and can be removed', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'fixedTypes/t1'), { name: 'Alquiler', disabled: true });
    });
    const db = household();
    await assertSucceeds(getDoc(doc(db, 'fixedExpenses/t1_2026-11')));
    await assertFails(setDoc(doc(db, 'fixedExpenses/t1_2026-12'), { typeId: 't1', month: '2026-12', amount: 5 }));
    await assertFails(setDoc(doc(db, 'fixedExpenses/t1_2026-11'), { typeId: 't1', month: '2026-11', amount: 7 }));
    await assertSucceeds(deleteDoc(doc(db, 'fixedExpenses/t1_2026-11')));
  });

  it('denies everyone else', async () => {
    await assertFails(getDoc(doc(stranger(), 'fixedExpenses/t1_2026-11')));
    await assertFails(setDoc(doc(stranger(), 'fixedExpenses/t1_2026-12'), { typeId: 't1', month: '2026-12', amount: 5 }));
  });
});
