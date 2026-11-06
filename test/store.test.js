import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { createStore } from '../src/store.js';

let db;
let store;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with `npm run test:store` (Firestore emulator)');
  db = new Firestore({ projectId: 'demo-expenses' });
  store = createStore(db);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('expenses'));
  await db.recursiveDelete(db.collection('state'));
});

const expense = (over = {}) => ({
  purchaseDate: '2026-03-15',
  receivedAt: new Date('2026-03-15T18:30:00Z'),
  merchant: 'RECARGAS EJEMPLO',
  amount: 12500,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  ...over,
});

describe('store', () => {
  it('saveExpense returns true the first time and false the second without modifying the document', async () => {
    expect(await store.saveExpense('m1', expense())).toBe(true);
    expect(await store.saveExpense('m1', expense({ amount: 1 }))).toBe(false);
    const doc = await db.collection('expenses').doc('m1').get();
    expect(doc.data().amount).toBe(12500);
  });

  it('stores purchaseDate as a Timestamp at 00:00 Buenos Aires time', async () => {
    await store.saveExpense('m1', expense());
    const doc = await db.collection('expenses').doc('m1').get();
    expect(doc.data().purchaseDate.toDate().toISOString()).toBe('2026-03-15T03:00:00.000Z');
    expect(doc.data().receivedAt.toDate().toISOString()).toBe('2026-03-15T18:30:00.000Z');
    expect(doc.data()).toMatchObject({ merchant: 'RECARGAS EJEMPLO', currency: 'ARS', cardLast4: '1234' });
  });

  it('stores card type, card holder and status', async () => {
    await store.saveExpense('m1', expense({ cardType: 'debit', cardHolder: 'MARIA', status: 'rejected' }));
    const doc = await db.collection('expenses').doc('m1').get();
    expect(doc.data()).toMatchObject({ cardType: 'debit', cardHolder: 'MARIA', status: 'rejected' });
  });

  it('getHistoryId returns null when there is no state', async () => {
    expect(await store.getHistoryId()).toBeNull();
  });

  it('setHistoryId never goes backwards', async () => {
    await store.setHistoryId('200');
    await store.setHistoryId('150');
    expect(await store.getHistoryId()).toBe('200');
  });

  it('setHistoryId compares numerically', async () => {
    await store.setHistoryId('999');
    await store.setHistoryId('1000');
    expect(await store.getHistoryId()).toBe('1000');
  });

  it('sumByRange only sums expenses inside the range', async () => {
    await store.saveExpense('a', expense({ purchaseDate: '2026-10-05', amount: 100 }));
    await store.saveExpense('b', expense({ purchaseDate: '2026-10-31', amount: 250 }));
    await store.saveExpense('c', expense({ purchaseDate: '2026-11-01', amount: 999 }));
    const total = await store.sumByRange(new Date('2026-10-01T03:00:00Z'), new Date('2026-11-01T03:00:00Z'));
    expect(total).toBe(350);
  });

  it('sumByRange ignores rejected purchases and counts documents without status as approved', async () => {
    await store.saveExpense('a', expense({ purchaseDate: '2026-10-05', amount: 100 }));
    await store.saveExpense('r', expense({ purchaseDate: '2026-10-06', amount: 500, status: 'rejected' }));
    await db.collection('expenses').doc('legacy').set({ purchaseDate: Timestamp.fromDate(new Date('2026-10-07T03:00:00Z')), amount: 40 });
    const total = await store.sumByRange(new Date('2026-10-01T03:00:00Z'), new Date('2026-11-01T03:00:00Z'));
    expect(total).toBe(140);
  });
});
