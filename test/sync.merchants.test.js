import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { processNotification, reconcile } from '../src/sync.js';

const base = JSON.parse(readFileSync(new URL('./fixtures/gmail-message.json', import.meta.url), 'utf8'));

function msg(id) {
  const m = structuredClone(base);
  m.id = id;
  return m;
}

// Same fakes as test/sync.test.js, with a merchant dictionary (key -> categoryId).
function fakeStore(dictionary = {}) {
  const expenses = new Map();
  let historyId = null;
  return {
    expenses,
    saveExpense: vi.fn(async (id, e) => {
      if (expenses.has(id)) return false;
      expenses.set(id, e);
      return true;
    }),
    getMerchantCategory: vi.fn(async (key) => dictionary[key] ?? null),
    getHistoryId: vi.fn(async () => historyId),
    setHistoryId: vi.fn(async (id) => {
      if (historyId === null || BigInt(id) > BigInt(historyId)) historyId = String(id);
    }),
  };
}

function fakeGmail(messages) {
  return {
    getMessage: vi.fn(async (id) => messages[id]),
    listHistory: vi.fn(async () => ({ messageIds: Object.keys(messages), historyId: '500' })),
    listMessages: vi.fn(async () => Object.keys(messages)),
    startWatch: vi.fn(async () => ({ historyId: '100' })),
  };
}

const config = { user: 'user@example.com', labelName: 'card-expenses' };
const notification = { emailAddress: 'user@example.com', historyId: '500' };
let store, logger;
const deps = (gmail) => ({ gmail, store, config, logger });

beforeEach(() => {
  logger = { info: vi.fn(), error: vi.fn() };
});

describe('processNotification with the merchant dictionary', () => {
  it('sets the categoryId of a new purchase when the merchant is in the dictionary', async () => {
    store = fakeStore({ 'recargas-ejemplo': 'cat-recargas' });
    await store.setHistoryId('400');
    const r = await processNotification(deps(fakeGmail({ m1: msg('m1') })), notification);
    expect(r.saved).toBe(1);
    expect(store.getMerchantCategory).toHaveBeenCalledWith('recargas-ejemplo');
    expect(store.expenses.get('m1')).toMatchObject({ merchant: 'RECARGAS EJEMPLO', categoryId: 'cat-recargas' });
  });

  it('leaves the purchase without categoryId when the dictionary returns null', async () => {
    store = fakeStore();
    await store.setHistoryId('400');
    await processNotification(deps(fakeGmail({ m1: msg('m1') })), notification);
    expect(store.getMerchantCategory).toHaveBeenCalledTimes(1);
    expect(store.expenses.get('m1')).toBeDefined();
    expect(store.expenses.get('m1')).not.toHaveProperty('categoryId');
  });

  it('does not set a categoryId for an empty category', async () => {
    store = fakeStore({ 'recargas-ejemplo': '' });
    await store.setHistoryId('400');
    await processNotification(deps(fakeGmail({ m1: msg('m1') })), notification);
    expect(store.expenses.get('m1')).not.toHaveProperty('categoryId');
  });

  it('keeps the rest of the purchase data when it adds the category', async () => {
    store = fakeStore({ 'recargas-ejemplo': 'cat-recargas' });
    await store.setHistoryId('400');
    await processNotification(deps(fakeGmail({ m1: msg('m1') })), notification);
    expect(store.expenses.get('m1')).toMatchObject({ amount: 12500, purchaseDate: '2026-03-15' });
    expect(store.expenses.get('m1').receivedAt).toBeInstanceOf(Date);
  });
});

describe('reconcile with the merchant dictionary', () => {
  it('sets the categoryId of a missing purchase when the merchant is in the dictionary', async () => {
    store = fakeStore({ 'recargas-ejemplo': 'cat-recargas' });
    const r = await reconcile(deps(fakeGmail({ m1: msg('m1') })));
    expect(r.saved).toBe(1);
    expect(store.expenses.get('m1')).toMatchObject({ categoryId: 'cat-recargas' });
  });

  it('does not set a categoryId when the dictionary returns null', async () => {
    store = fakeStore();
    await reconcile(deps(fakeGmail({ m1: msg('m1') })));
    expect(store.expenses.get('m1')).toBeDefined();
    expect(store.expenses.get('m1')).not.toHaveProperty('categoryId');
  });
});
