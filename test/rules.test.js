import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';

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
    await setDoc(doc(ctx.firestore(), 'expenses/e1'), { merchant: 'RECARGAS EJEMPLO', amount: 12500 });
    await setDoc(doc(ctx.firestore(), 'state/sync'), { historyId: '100' });
    await setDoc(doc(ctx.firestore(), 'other/o1'), { value: 1 });
  });
});

const household = () => testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true });

describe('firestore rules', () => {
  it('denies reads when signed out', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'expenses/e1')));
    await assertFails(getDocs(collection(db, 'expenses')));
  });

  it('denies reads when signed in without the household claim', async () => {
    const db = testEnv.authenticatedContext('user2', { email: 'stranger@example.com', email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, 'expenses/e1')));
    await assertFails(getDocs(collection(db, 'expenses')));
  });

  it('denies reads when the claim is false', async () => {
    const db = testEnv.authenticatedContext('user2', { email_verified: true, household: false }).firestore();
    await assertFails(getDoc(doc(db, 'expenses/e1')));
  });

  it('denies reads when the claim is present but the email is not verified', async () => {
    const db = testEnv.authenticatedContext('user1', { email_verified: false, household: true }).firestore();
    await assertFails(getDoc(doc(db, 'expenses/e1')));
  });

  it('allows reading expenses with the claim and a verified email', async () => {
    const db = household().firestore();
    await assertSucceeds(getDoc(doc(db, 'expenses/e1')));
    await assertSucceeds(getDocs(collection(db, 'expenses')));
  });

  it('denies create, update and delete of expenses even with the claim', async () => {
    const db = household().firestore();
    await assertFails(setDoc(doc(db, 'expenses/new'), { merchant: 'X', amount: 1 }));
    await assertFails(updateDoc(doc(db, 'expenses/e1'), { amount: 1 }));
    await assertFails(deleteDoc(doc(db, 'expenses/e1')));
  });

  it('denies reading state/sync and any other collection even with the claim', async () => {
    const db = household().firestore();
    await assertFails(getDoc(doc(db, 'state/sync')));
    await assertFails(getDoc(doc(db, 'other/o1')));
    await assertFails(setDoc(doc(db, 'other/o2'), { value: 2 }));
  });
});
