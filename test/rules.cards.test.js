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

const ACCOUNT = { name: 'Cuenta de ejemplo', owner: 'PERSONA' };
const CARD = { last4: '1234', type: 'credit', holder: 'PERSONA', accountId: 'a1' };
const CYCLE = { accountId: 'a1', closingDate: '2026-11-15', dueDate: '2026-11-25' };
const EXISTING = { accounts: 'accounts/a1', cards: 'cards/1234_credit', cycles: 'cycles/a1_2026-11-15' };

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'accounts/a1'), ACCOUNT);
    await setDoc(doc(db, 'cards/1234_credit'), CARD);
    await setDoc(doc(db, 'cycles/a1_2026-11-15'), CYCLE);
    await setDoc(doc(db, 'expenses/e1'), { merchant: 'RECARGAS EJEMPLO', amount: 12500 });
    await setDoc(doc(db, 'state/sync'), { historyId: '100' });
  });
});

const household = () =>
  testEnv.authenticatedContext('user1', { email: 'user@example.com', email_verified: true, household: true }).firestore();

const unauthorized = () => [
  testEnv.unauthenticatedContext().firestore(),
  testEnv.authenticatedContext('u2', { email_verified: true }).firestore(),
  testEnv.authenticatedContext('u3', { email_verified: false, household: true }).firestore(),
];

// Every unauthorized context can neither write the valid document nor read an existing one.
async function expectDeniedWhenUnauthorized(path, data) {
  const existing = EXISTING[path.split('/')[0]];
  for (const db of unauthorized()) {
    await assertFails(setDoc(doc(db, path), data));
    await assertFails(getDoc(doc(db, existing)));
    await assertFails(deleteDoc(doc(db, existing)));
  }
}

const long = 'x'.repeat(41);

describe('accounts rules', () => {
  it('an authorized person can create a valid document', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'accounts/new1'), { name: 'Otra', owner: 'OTRA' }));
    await assertSucceeds(getDoc(doc(db, 'accounts/a1')));
    await assertSucceeds(getDocs(collection(db, 'accounts')));
  });
  it('signed out, without the claim or with an unverified email is denied', async () => {
    await expectDeniedWhenUnauthorized('accounts/new1', ACCOUNT);
  });
  it('extra field is denied', async () => {
    await assertFails(setDoc(doc(household(), 'accounts/new1'), { ...ACCOUNT, extra: 1 }));
  });
  it('missing field is denied', async () => {
    await assertFails(setDoc(doc(household(), 'accounts/new1'), { name: 'Otra' }));
  });
  it('wrong type is denied', async () => {
    await assertFails(setDoc(doc(household(), 'accounts/new1'), { name: 5, owner: 'X' }));
    await assertFails(setDoc(doc(household(), 'accounts/new1'), { name: 'X', owner: null }));
  });
  it('name or owner longer than 40 characters or empty is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'accounts/new1'), { name: long, owner: 'X' }));
    await assertFails(setDoc(doc(db, 'accounts/new1'), { name: 'X', owner: long }));
    await assertFails(setDoc(doc(db, 'accounts/new1'), { name: '', owner: 'X' }));
    await assertFails(setDoc(doc(db, 'accounts/new1'), { name: 'X', owner: '' }));
    await assertSucceeds(setDoc(doc(db, 'accounts/new1'), { name: 'x'.repeat(40), owner: 'X' }));
  });
  it('update of name and owner is allowed', async () => {
    const db = household();
    await assertFails(updateDoc(doc(db, 'accounts/a1'), { extra: 1 }));
    await assertFails(updateDoc(doc(db, 'accounts/a1'), { name: long }));
    await assertSucceeds(updateDoc(doc(db, 'accounts/a1'), { name: 'Nuevo', owner: 'NUEVO' }));
  });
  it('delete is allowed', async () => {
    await assertSucceeds(deleteDoc(doc(household(), 'accounts/a1')));
  });
});

describe('cards rules', () => {
  const newCard = { last4: '5678', type: 'debit', holder: 'OTRA', accountId: 'a1' };
  it('an authorized person can create a valid document', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, 'cards/5678_debit'), newCard));
    await assertSucceeds(getDoc(doc(db, 'cards/1234_credit')));
    await assertSucceeds(getDocs(collection(db, 'cards')));
  });
  it('signed out, without the claim or with an unverified email is denied', async () => {
    await expectDeniedWhenUnauthorized('cards/5678_debit', newCard);
  });
  it('extra field is denied', async () => {
    await assertFails(setDoc(doc(household(), 'cards/5678_debit'), { ...newCard, extra: 1 }));
  });
  it('missing field is denied', async () => {
    const { holder, ...rest } = newCard;
    await assertFails(setDoc(doc(household(), 'cards/5678_debit'), rest));
  });
  it('wrong type is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'cards/5678_debit'), { ...newCard, holder: 7 }));
    await assertFails(setDoc(doc(db, 'cards/5678_debit'), { ...newCard, accountId: 7 }));
    await assertFails(setDoc(doc(db, 'cards/5678_debit'), { ...newCard, last4: 5678 }));
  });
  it('name or owner longer than 40 characters or empty is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'cards/5678_debit'), { ...newCard, holder: long }));
    await assertFails(setDoc(doc(db, 'cards/5678_debit'), { ...newCard, holder: '' }));
    await assertSucceeds(setDoc(doc(db, 'cards/5678_debit'), { ...newCard, holder: 'x'.repeat(40) }));
  });
  it('a document ID that differs from last4_type is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'cards/9999_debit'), newCard));
    await assertFails(setDoc(doc(db, 'cards/5678_credit'), newCard));
  });
  it('last4 that is not 4 digits or an unknown type is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'cards/567_debit'), { ...newCard, last4: '567' }));
    await assertFails(setDoc(doc(db, 'cards/56789_debit'), { ...newCard, last4: '56789' }));
    await assertFails(setDoc(doc(db, 'cards/56a8_debit'), { ...newCard, last4: '56a8' }));
    await assertFails(setDoc(doc(db, 'cards/5678_prepaid'), { ...newCard, type: 'prepaid' }));
  });
  it('a card for a missing account is denied', async () => {
    await assertFails(setDoc(doc(household(), 'cards/5678_debit'), { ...newCard, accountId: 'nope' }));
  });
  it('update may change holder and accountId but not last4 or type', async () => {
    const db = household();
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'accounts/a2'), { name: 'Segunda', owner: 'SEGUNDA' });
    });
    await assertFails(updateDoc(doc(db, 'cards/1234_credit'), { accountId: 'nope' }));
    await assertFails(updateDoc(doc(db, 'cards/1234_credit'), { holder: '' }));
    await assertFails(updateDoc(doc(db, 'cards/1234_credit'), { last4: '4321' }));
    await assertFails(updateDoc(doc(db, 'cards/1234_credit'), { type: 'debit' }));
    await assertFails(updateDoc(doc(db, 'cards/1234_credit'), { extra: 1 }));
    await assertSucceeds(updateDoc(doc(db, 'cards/1234_credit'), { holder: 'NUEVA', accountId: 'a2' }));
  });
  it('delete is allowed', async () => {
    await assertSucceeds(deleteDoc(doc(household(), 'cards/1234_credit')));
  });
});

describe('cycles rules', () => {
  const newCycle = { accountId: 'a1', closingDate: '2026-12-15', dueDate: '2026-12-26' };
  const id = 'cycles/a1_2026-12-15';
  it('an authorized person can create a valid document', async () => {
    const db = household();
    await assertSucceeds(setDoc(doc(db, id), newCycle));
    await assertSucceeds(getDoc(doc(db, 'cycles/a1_2026-11-15')));
    await assertSucceeds(getDocs(collection(db, 'cycles')));
  });
  it('signed out, without the claim or with an unverified email is denied', async () => {
    await expectDeniedWhenUnauthorized(id, newCycle);
  });
  it('extra field is denied', async () => {
    await assertFails(setDoc(doc(household(), id), { ...newCycle, extra: 1 }));
  });
  it('missing field is denied', async () => {
    const { dueDate, ...rest } = newCycle;
    await assertFails(setDoc(doc(household(), id), rest));
  });
  it('wrong type is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, id), { ...newCycle, dueDate: 20261226 }));
    await assertFails(setDoc(doc(db, id), { ...newCycle, closingDate: 5 }));
    await assertFails(setDoc(doc(db, id), { ...newCycle, accountId: 5 }));
  });
  it('name or owner longer than 40 characters or empty is denied', async () => {
    // Cycles have no name or owner: an empty or oversized accountId can never reference an existing account.
    const db = household();
    await assertFails(setDoc(doc(db, 'cycles/_2026-12-15'), { ...newCycle, accountId: '' }));
    await assertFails(setDoc(doc(db, `cycles/${long}_2026-12-15`), { ...newCycle, accountId: long }));
  });
  it('a malformed date is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'cycles/a1_15-12-2026'), { ...newCycle, closingDate: '15-12-2026' }));
    await assertFails(setDoc(doc(db, 'cycles/a1_2026-1-15'), { ...newCycle, closingDate: '2026-1-15' }));
    await assertFails(setDoc(doc(db, id), { ...newCycle, dueDate: '26-12-2026' }));
    await assertFails(setDoc(doc(db, id), { ...newCycle, dueDate: '2026-12-26T00:00' }));
    await assertFails(setDoc(doc(db, id), { ...newCycle, dueDate: '' }));
  });
  it('a due date before the closing date is denied', async () => {
    await assertFails(setDoc(doc(household(), id), { ...newCycle, dueDate: '2026-12-14' }));
    await assertSucceeds(setDoc(doc(household(), id), { ...newCycle, dueDate: '2026-12-15' }));
  });
  it('a null due date is allowed', async () => {
    await assertSucceeds(setDoc(doc(household(), id), { ...newCycle, dueDate: null }));
  });
  it('a document ID that differs from accountId_closingDate is denied', async () => {
    const db = household();
    await assertFails(setDoc(doc(db, 'cycles/a1_2026-12-16'), newCycle));
    await assertFails(setDoc(doc(db, 'cycles/other'), newCycle));
  });
  it('a cycle for a missing account is denied', async () => {
    await assertFails(setDoc(doc(household(), 'cycles/nope_2026-12-15'), { ...newCycle, accountId: 'nope' }));
  });
  it('updating an existing cycle is denied and writing over its ID is denied', async () => {
    const db = household();
    await assertFails(updateDoc(doc(db, 'cycles/a1_2026-11-15'), { dueDate: '2026-11-30' }));
    await assertFails(setDoc(doc(db, 'cycles/a1_2026-11-15'), { ...CYCLE, dueDate: '2026-11-30' }));
  });
  it('delete is allowed', async () => {
    await assertSucceeds(deleteDoc(doc(household(), 'cycles/a1_2026-11-15')));
  });
});

describe('unchanged rules', () => {
  it('the existing expenses and state/sync rules still hold', async () => {
    const db = household();
    await assertSucceeds(getDoc(doc(db, 'expenses/e1')));
    await assertFails(setDoc(doc(db, 'expenses/new'), { merchant: 'X', amount: 1 }));
    await assertFails(updateDoc(doc(db, 'expenses/e1'), { amount: 1 }));
    await assertFails(deleteDoc(doc(db, 'expenses/e1')));
    await assertFails(getDoc(doc(db, 'state/sync')));
    await assertFails(setDoc(doc(db, 'state/sync'), { historyId: '1' }));
    await assertFails(setDoc(doc(db, 'other/o1'), { value: 1 }));
  });
});
