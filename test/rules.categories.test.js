import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, deleteField } from 'firebase/firestore';

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
    const db = ctx.firestore();
    await setDoc(doc(db, 'categories/comida'), { name: 'comida', color: '#22c55e' });
    await setDoc(doc(db, 'expenses/e1'), { merchant: 'RECARGAS EJEMPLO', amount: 12500, categoryId: 'comida' });
  });
});

const household = () =>
  testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true }).firestore();
const stranger = () => testEnv.authenticatedContext('u2', { email_verified: true }).firestore();

describe('categories', () => {
  it('the household reads, creates, updates and deletes valid categories', async () => {
    const db = household();
    await assertSucceeds(getDoc(doc(db, 'categories/comida')));
    await assertSucceeds(setDoc(doc(db, 'categories/nueva'), { name: 'Nueva', color: '#aabbcc' }));
    await assertSucceeds(updateDoc(doc(db, 'categories/comida'), { name: 'Comida', color: '#112233' }));
    await assertSucceeds(deleteDoc(doc(db, 'categories/comida')));
  });

  it('rejects invalid categories', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'categories/x'), { name: '', color: '#aabbcc' }));
    await assertFails(setDoc(doc(db, 'categories/x'), { name: 'a'.repeat(41), color: '#aabbcc' }));
    await assertFails(setDoc(doc(db, 'categories/x'), { name: 'X', color: 'red' }));
    await assertFails(setDoc(doc(db, 'categories/x'), { name: 'X', color: '#aabbcc', extra: 1 }));
    await assertFails(setDoc(doc(db, 'categories/x'), { name: 'X' }));
  });

  it('denies everyone else', async () => {
    await assertFails(getDoc(doc(stranger(), 'categories/comida')));
    await assertFails(setDoc(doc(stranger(), 'categories/x'), { name: 'X', color: '#aabbcc' }));
  });
});

describe('expense category', () => {
  it('the household can set, change and clear only the categoryId', async () => {
    const db = household();
    await assertSucceeds(updateDoc(doc(db, 'expenses/e1'), { categoryId: 'otra' }));
    await assertSucceeds(updateDoc(doc(db, 'expenses/e1'), { categoryId: deleteField() }));
    await assertSucceeds(updateDoc(doc(db, 'expenses/e1'), { categoryId: null }));
  });

  it('still denies changing anything else, and creating or deleting expenses', async () => {
    const db = household();
    await assertFails(updateDoc(doc(db, 'expenses/e1'), { amount: 1 }));
    await assertFails(updateDoc(doc(db, 'expenses/e1'), { categoryId: 'x', amount: 1 }));
    await assertFails(updateDoc(doc(db, 'expenses/e1'), { categoryId: 123 }));
    await assertFails(setDoc(doc(db, 'expenses/new'), { merchant: 'X', amount: 1 }));
    await assertFails(deleteDoc(doc(db, 'expenses/e1')));
  });

  it('denies everyone else', async () => {
    await assertFails(updateDoc(doc(stranger(), 'expenses/e1'), { categoryId: 'x' }));
  });
});

describe('merchantCategories', () => {
  it('the household can save and read a merchant category with a valid key', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'merchantCategories/dia-tienda'), { merchant: 'DIA TIENDA 777', categoryId: 'comida' }));
    await assertSucceeds(getDoc(doc(db, 'merchantCategories/dia-tienda')));
  });

  it('rejects invalid keys, extra fields and missing fields', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'merchantCategories/Dia Tienda'), { merchant: 'X', categoryId: 'comida' }));
    await assertFails(setDoc(doc(db, 'merchantCategories/dia'), { merchant: 'X', categoryId: 'comida', extra: 1 }));
    await assertFails(setDoc(doc(db, 'merchantCategories/dia'), { merchant: 'X' }));
    await assertFails(setDoc(doc(db, 'merchantCategories/dia'), { merchant: '', categoryId: 'comida' }));
  });

  it('denies everyone else', async () => {
    await assertFails(setDoc(doc(stranger(), 'merchantCategories/dia'), { merchant: 'X', categoryId: 'comida' }));
    await assertFails(getDoc(doc(stranger(), 'merchantCategories/dia')));
  });
});
