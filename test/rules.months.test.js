import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, arrayUnion, deleteField, runTransaction } from 'firebase/firestore';

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

const emptyMonth = () => ({
  purchases: {}, edits: {}, incomes: {}, savings: {}, fixed: {},
  rate: null, rateInherited: false, cap: null, capInherited: false,
});

const seed = (fn) => testEnv.withSecurityRulesDisabled(async (ctx) => { await fn(ctx.firestore()); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, 'months/2026-10'), {
      ...emptyMonth(),
      purchases: { p1: { merchant: 'RECARGAS EJEMPLO', amount: 12500, currency: 'ARS' } },
      edits: { p1: { category: 'c1' } },
      incomes: { i1: { amount: 100, currency: 'ARS', date: '2026-10-05', owner: 'A' } },
      fixed: { t1: 500 },
      rate: 1000,
    });
    await setDoc(doc(db, 'config/cards'), {
      accounts: { a1: { name: 'Visa', owner: 'A' } },
      cards: {},
      cycles: { 'a1_2026-10-23': { accountId: 'a1', closingDate: '2026-10-23', dueDate: '2026-11-03' } },
      seenCards: { '1234_credit': { last4: '1234', type: 'credit', holder: 'A', lastSeen: '2026-10-01' } },
    });
    await setDoc(doc(db, 'config/categories'), { items: { c1: { name: 'Comida', color: '#aabbcc', archived: false } } });
    await setDoc(doc(db, 'config/months'), { list: ['2026-10'] });
    await setDoc(doc(db, 'meta/uncategorized'), { items: {} });
    await setDoc(doc(db, 'expenses/e1'), { merchant: 'RECARGAS EJEMPLO', amount: 12500 });
    await setDoc(doc(db, 'state/sync'), { historyId: '100' });
  });
});

const household = () => testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true }).firestore();

describe('access', () => {
  it('denies reads when signed out', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'months/2026-10')));
    await assertFails(getDoc(doc(db, 'config/cards')));
  });

  it('denies reads without the household claim', async () => {
    const db = testEnv.authenticatedContext('user2', { email: 'stranger@example.com', email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, 'months/2026-10')));
    await assertFails(getDoc(doc(db, 'config/cards')));
  });

  it('denies reads with the claim but an unverified email', async () => {
    const db = testEnv.authenticatedContext('user1', { email_verified: false, household: true }).firestore();
    await assertFails(getDoc(doc(db, 'months/2026-10')));
  });

  it('allows the household to read months and config', async () => {
    const db = household();
    await assertSucceeds(getDoc(doc(db, 'months/2026-10')));
    await assertSucceeds(getDoc(doc(db, 'config/cards')));
    await assertSucceeds(getDoc(doc(db, 'meta/uncategorized')));
  });

  it('denies old collections and state/sync to everyone', async () => {
    const db = household();
    await assertFails(getDoc(doc(db, 'expenses/e1')));
    await assertFails(getDocs(collection(db, 'expenses')));
    await assertFails(setDoc(doc(db, 'expenses/e2'), { merchant: 'X' }));
    await assertFails(getDoc(doc(db, 'state/sync')));
    await assertFails(setDoc(doc(db, 'state/sync'), { historyId: '1' }));
    await assertFails(setDoc(doc(db, 'categories/c1'), { name: 'X', color: '#aabbcc' }));
    await assertFails(setDoc(doc(db, 'exchangeRates/2026-10'), { rate: 1 }));
  });
});

describe('months', () => {
  it('does not let the household change the bank data in purchases', async () => {
    const db = household();
    await assertFails(updateDoc(doc(db, 'months/2026-10'), { 'purchases.p1.amount': 1 }));
    await assertFails(updateDoc(doc(db, 'months/2026-10'), { 'purchases.p2': { merchant: 'Z', amount: 1 } }));
    await assertFails(updateDoc(doc(db, 'months/2026-10'), { purchases: {} }));
    await assertFails(setDoc(doc(db, 'months/2026-10'), { purchases: { p1: { amount: 1 } } }, { merge: true }));
    await assertFails(setDoc(doc(db, 'months/2026-10'), emptyMonth()));
    const ref = doc(db, 'months/2026-10');
    await assertFails(runTransaction(db, async (tx) => {
      await tx.get(ref);
      tx.set(ref, emptyMonth());
    }));
  });

  it('does not let the household create a month with purchases', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'months/2026-11'), { ...emptyMonth(), purchases: { p1: { amount: 1 } } }));
  });

  it('does not let the household create a month with unknown keys', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'months/2026-11'), { ...emptyMonth(), extra: 1 }));
  });

  it('does not let the household delete a month', async () => {
    await assertFails(deleteDoc(doc(household(), 'months/2026-10')));
  });

  it('does not let the household add unknown keys to a month', async () => {
    await assertFails(updateDoc(doc(household(), 'months/2026-10'), { extra: 1 }));
  });

  it('lets the household edit everything except purchases', async () => {
    const db = household();
    const ref = doc(db, 'months/2026-10');
    await assertSucceeds(updateDoc(ref, { 'edits.p1.category': 'c2' }));
    await assertSucceeds(updateDoc(ref, { 'edits.p1.note': 'regalo' }));
    await assertSucceeds(updateDoc(ref, { 'incomes.i2': { amount: 5, currency: 'USD', date: '2026-10-06', owner: 'B' } }));
    await assertSucceeds(updateDoc(ref, { 'savings.s1': { amount: 5, currency: 'ARS', date: '2026-10-06' } }));
    await assertSucceeds(updateDoc(ref, { 'fixed.t1': 600 }));
    await assertSucceeds(updateDoc(ref, { rate: 1200, rateInherited: false }));
    await assertSucceeds(updateDoc(ref, { capInherited: true }));
  });

  it('handles deleteField: allowed on edits, denied on purchases', async () => {
    const ref = doc(household(), 'months/2026-10');
    await assertSucceeds(updateDoc(ref, { 'edits.p1.note': deleteField() }));
    await assertFails(updateDoc(ref, { 'purchases.p1': deleteField() }));
  });

  it('lets the household create an empty month with the full shape', async () => {
    await assertSucceeds(setDoc(doc(household(), 'months/2026-11'), emptyMonth()));
  });

  it('rejects invalid month ids', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'months/2026-13'), emptyMonth()));
    await assertFails(setDoc(doc(db, 'months/2026-00'), emptyMonth()));
    await assertFails(setDoc(doc(db, 'months/2026-1'), emptyMonth()));
    await assertFails(setDoc(doc(db, 'months/latest'), emptyMonth()));
  });
});

describe('config/cards', () => {
  it('does not let the household write seenCards', async () => {
    const db = household();
    const ref = doc(db, 'config/cards');
    await assertFails(updateDoc(ref, { 'seenCards.9999_debit': { last4: '9999', type: 'debit', holder: 'B', lastSeen: '2026-10-02' } }));
    await assertFails(updateDoc(ref, { 'seenCards.1234_credit.lastSeen': '2026-10-09' }));
    await assertFails(updateDoc(ref, { 'seenCards.1234_credit': deleteField() }));
    await assertFails(setDoc(ref, { seenCards: { x: {} } }, { merge: true }));
  });

  it('lets the household write accounts, cards and cycles', async () => {
    const db = household();
    const ref = doc(db, 'config/cards');
    await assertSucceeds(updateDoc(ref, { 'cycles.a1_2026-11-23': { accountId: 'a1', closingDate: '2026-11-23', dueDate: null } }));
    await assertSucceeds(updateDoc(ref, { 'accounts.a2': { name: 'Master', owner: 'B' } }));
    await assertSucceeds(updateDoc(ref, { 'cards.1234_credit': { last4: '1234', type: 'credit', holder: 'A', accountId: 'a1' } }));
  });

  it('allows creating config/cards without seenCards, or with it empty', async () => {
    const db = household();
    await seed((s) => deleteDoc(doc(s, 'config/cards')));
    await assertSucceeds(setDoc(doc(db, 'config/cards'), { cycles: { k: { accountId: 'a1' } } }, { merge: true }));
    await seed((s) => deleteDoc(doc(s, 'config/cards')));
    await assertSucceeds(setDoc(doc(db, 'config/cards'), { accounts: {}, cards: {}, cycles: {}, seenCards: {} }));
  });

  it('does not allow creating config/cards with seenCards filled, or with unknown keys', async () => {
    const db = household();
    await seed((s) => deleteDoc(doc(s, 'config/cards')));
    await assertFails(setDoc(doc(db, 'config/cards'), { seenCards: { x: {} } }));
    await assertFails(setDoc(doc(db, 'config/cards'), { extra: 1 }));
  });

  it('does not let the household delete it', async () => {
    await assertFails(deleteDoc(doc(household(), 'config/cards')));
  });
});

describe('other config documents', () => {
  it('lets the household write items', async () => {
    const db = household();
    await assertSucceeds(updateDoc(doc(db, 'config/categories'), { 'items.c2': { name: 'Ocio', color: '#112233', archived: false } }));
    await assertSucceeds(setDoc(doc(db, 'config/fixedTypes'), { items: { t1: { name: 'Alquiler', disabled: false } } }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, 'config/merchants'), { items: { k: { merchant: 'K', categoryId: 'c1' } } }, { merge: true }));
    await assertSucceeds(updateDoc(doc(db, 'meta/uncategorized'), { 'items.p9': { month: '2026-10', merchant: 'M', amount: 1 } }));
  });

  it('does not let the household write an extra key', async () => {
    const db = household();
    await assertFails(updateDoc(doc(db, 'config/categories'), { extra: 1 }));
    await assertFails(updateDoc(doc(db, 'meta/uncategorized'), { extra: 1 }));
    await assertFails(setDoc(doc(db, 'config/merchants'), { extra: 1 }, { merge: true }));
  });

  it('does not let the household delete them', async () => {
    const db = household();
    await assertFails(deleteDoc(doc(db, 'config/categories')));
    await assertFails(deleteDoc(doc(db, 'config/months')));
    await assertFails(deleteDoc(doc(db, 'meta/uncategorized')));
  });

  it('does not allow other documents under config or meta', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'config/other'), { items: {} }));
    await assertFails(setDoc(doc(db, 'meta/other'), { items: {} }));
  });
});

describe('config/months', () => {
  it('lets the household add a month with arrayUnion, and create the document', async () => {
    const db = household();
    await assertSucceeds(updateDoc(doc(db, 'config/months'), { list: arrayUnion('2026-11') }));
    await seed((s) => deleteDoc(doc(s, 'config/months')));
    await assertSucceeds(setDoc(doc(db, 'config/months'), { list: arrayUnion('2026-11') }, { merge: true }));
  });

  it('only accepts a list', async () => {
    const db = household();
    await assertFails(updateDoc(doc(db, 'config/months'), { list: 'x' }));
    await assertFails(updateDoc(doc(db, 'config/months'), { extra: 1 }));
  });
});
