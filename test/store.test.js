import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Firestore, FieldPath, FieldValue } from '@google-cloud/firestore';
import { createStore } from '../src/store.js';

let db;
let store;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run with `npm run test:store` (Firestore emulator)');
  db = new Firestore({ projectId: 'demo-expenses' });
  store = createStore(db);
});

beforeEach(async () => {
  for (const name of ['months', 'config', 'meta', 'state']) await db.recursiveDelete(db.collection(name));
});

const purchase = (over = {}) => ({
  purchaseDate: '2026-10-15',
  receivedAt: new Date('2026-10-15T18:30:00Z'),
  merchant: 'RECARGAS EJEMPLO',
  amount: 12500,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  ...over,
});

const monthData = async (month) => (await db.doc(`months/${month}`).get()).data();
const uncategorized = async () => (await db.doc('meta/uncategorized').get()).data()?.items ?? {};

describe('store', () => {
  it('creates the month and returns true; a second call returns false and changes nothing', async () => {
    expect(await store.savePurchase('m1', purchase(), null)).toBe(true);
    const before = await monthData('2026-10');
    expect(await store.savePurchase('m1', purchase({ amount: 1 }), 'food')).toBe(false);
    const after = await monthData('2026-10');
    expect(after.purchases.m1.amount).toBe(12500);
    expect(after).toEqual(before);
    expect(after).toMatchObject({ edits: {}, incomes: {}, savings: {}, fixed: {} });
    expect(after.purchases.m1).toMatchObject({
      merchant: 'RECARGAS EJEMPLO', currency: 'ARS', cardLast4: '1234', cardType: 'credit', cardHolder: 'JUAN', status: 'approved',
    });
    expect(after.purchases.m1.receivedAt.toDate().toISOString()).toBe('2026-10-15T18:30:00.000Z');
  });

  it('reprocessing a categorized purchase keeps its category and does not list it again', async () => {
    await store.savePurchase('m1', purchase(), null);
    expect(Object.keys(await uncategorized())).toEqual(['m1']);
    await db.doc('months/2026-10').update(new FieldPath('edits', 'm1', 'category'), 'food');
    await db.doc('meta/uncategorized').update(new FieldPath('items', 'm1'), FieldValue.delete());

    expect(await store.savePurchase('m1', purchase(), null)).toBe(false);
    expect((await monthData('2026-10')).edits.m1.category).toBe('food');
    expect(await uncategorized()).toEqual({});
  });

  it('stores purchaseDate at 00:00 Buenos Aires in the month of that day', async () => {
    await store.savePurchase('m1', purchase({ purchaseDate: '2026-10-31' }), null);
    const data = await monthData('2026-10');
    expect(data.purchases.m1.purchaseDate.toDate().toISOString()).toBe('2026-10-31T03:00:00.000Z');
    expect((await db.doc('months/2026-11').get()).exists).toBe(false);
  });

  it('copies rate and cap from the latest earlier existing month and marks them inherited', async () => {
    await db.doc('months/2026-08').set({ rate: 1300, rateInherited: false, cap: 2e6, capInherited: false });
    await db.doc('months/2026-06').set({ rate: 1000, rateInherited: false, cap: 1e6, capInherited: false });
    await db.doc('config/months').set({ list: ['2026-08', '2026-06'] });

    await store.savePurchase('m1', purchase(), null);
    expect(await monthData('2026-10')).toMatchObject({ rate: 1300, rateInherited: true, cap: 2e6, capInherited: true });
    const list = (await db.doc('config/months').get()).data().list;
    expect([...list].sort()).toEqual(['2026-06', '2026-08', '2026-10']);
  });

  it('creates a month with null rate and cap when there is no earlier month', async () => {
    await db.doc('months/2026-12').set({ rate: 1500, rateInherited: false, cap: 3e6, capInherited: false });
    await db.doc('config/months').set({ list: ['2026-12'] });

    await store.savePurchase('m1', purchase(), null);
    expect(await monthData('2026-10')).toMatchObject({ rate: null, rateInherited: false, cap: null, capInherited: false });
  });

  it('writes the category to edits when given, else lists approved purchases as uncategorized', async () => {
    await store.savePurchase('cat', purchase(), 'food');
    await store.savePurchase('unc', purchase({ purchaseDate: '2026-10-20', amount: 700 }), null);
    await store.savePurchase('rej', purchase({ status: 'rejected' }), null);

    const data = await monthData('2026-10');
    expect(data.edits).toEqual({ cat: { category: 'food' } });
    const items = await uncategorized();
    expect(Object.keys(items)).toEqual(['unc']);
    expect(items.unc).toMatchObject({
      month: '2026-10', merchant: 'RECARGAS EJEMPLO', amount: 700, currency: 'ARS', cardLast4: '1234', cardType: 'credit', cardHolder: 'JUAN',
    });
    expect(items.unc.purchaseDate.toDate().toISOString()).toBe('2026-10-20T03:00:00.000Z');
  });

  it('writes seenCards only on the first purchase of a card in the month', async () => {
    await store.savePurchase('a', purchase({ purchaseDate: '2026-10-05' }), null);
    expect((await db.doc('config/cards').get()).data().seenCards).toEqual({
      '1234_credit': { last4: '1234', type: 'credit', holder: 'JUAN', lastSeen: '2026-10-05' },
    });

    await db.doc('config/cards').set({ seenCards: { '1234_credit': { last4: '1234', type: 'credit', holder: 'JUAN', lastSeen: 'manual' } } });
    await store.savePurchase('b', purchase({ purchaseDate: '2026-10-09' }), null);
    expect((await db.doc('config/cards').get()).data().seenCards['1234_credit'].lastSeen).toBe('manual');

    await store.savePurchase('c', purchase({ purchaseDate: '2026-10-10', cardType: 'debit' }), null);
    expect((await db.doc('config/cards').get()).data().seenCards['1234_debit'].lastSeen).toBe('2026-10-10');
  });

  it('getMerchantCategory reads config/merchants', async () => {
    await db.doc('config/merchants').set({ items: { recargas: { merchant: 'RECARGAS EJEMPLO', categoryId: 'phone' } } });
    expect(await store.getMerchantCategory('recargas')).toBe('phone');
    expect(await store.getMerchantCategory('other')).toBeNull();
    expect(await store.getMerchantCategory('')).toBeNull();
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
});
