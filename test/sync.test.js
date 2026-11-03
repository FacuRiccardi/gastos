import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { processNotification, reconcile, renewWatch, HistoryExpiredError } from '../src/sync.js';

const base = JSON.parse(readFileSync(new URL('./fixtures/gmail-message.json', import.meta.url), 'utf8'));

function msg(id, { from, subject, html } = {}) {
  const m = structuredClone(base);
  m.id = id;
  if (from) m.payload.headers.find((h) => h.name === 'From').value = from;
  if (subject) m.payload.headers.find((h) => h.name === 'Subject').value = subject;
  if (html !== undefined) m.payload.parts[0].parts[0].body.data = Buffer.from(html).toString('base64url');
  return m;
}

function fakeStore() {
  const expenses = new Map();
  let historyId = null;
  return {
    expenses,
    saveExpense: vi.fn(async (id, e) => {
      if (expenses.has(id)) return false;
      expenses.set(id, e);
      return true;
    }),
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
let store, logger;
const deps = (gmail) => ({ gmail, store, config, logger });
const notification = { emailAddress: 'user@example.com', historyId: '500' };

beforeEach(() => {
  store = fakeStore();
  logger = { info: vi.fn(), error: vi.fn() };
});

describe('processNotification', () => {
  it('saves a new purchase', async () => {
    await store.setHistoryId('400');
    const r = await processNotification(deps(fakeGmail({ m1: msg('m1') })), notification);
    expect(r.saved).toBe(1);
    expect(store.expenses.get('m1')).toMatchObject({ merchant: 'RECARGAS EJEMPLO', amount: 12500, purchaseDate: '2026-03-15' });
    expect(await store.getHistoryId()).toBe('500');
  });

  it('ignores a different sender or subject', async () => {
    await store.setHistoryId('400');
    const gmail = fakeGmail({ a: msg('a', { from: 'promos@other.com' }), b: msg('b', { subject: 'Account statement' }) });
    const r = await processNotification(deps(gmail), notification);
    expect(r.saved).toBe(0);
    expect(store.expenses.size).toBe(0);
  });

  it('does not duplicate when the same notification is reprocessed', async () => {
    await store.setHistoryId('400');
    const gmail = fakeGmail({ m1: msg('m1') });
    const r1 = await processNotification(deps(gmail), notification);
    const r2 = await processNotification(deps(gmail), { ...notification, historyId: '501' });
    expect([r1.saved, r2.saved]).toEqual([1, 0]);
    expect(store.expenses.size).toBe(1);
  });

  it('ignores notifications for another emailAddress', async () => {
    const gmail = fakeGmail({ m1: msg('m1') });
    const r = await processNotification(deps(gmail), { emailAddress: 'other@gmail.com', historyId: '500' });
    expect(r.saved).toBe(0);
    expect(gmail.listHistory).not.toHaveBeenCalled();
  });

  it('an email without the expected fields logs ERROR, is not saved and does not throw; the rest of the batch is processed', async () => {
    await store.setHistoryId('400');
    const gmail = fakeGmail({ bad: msg('bad', { html: '<p>new format</p>' }), m2: msg('m2') });
    const r = await processNotification(deps(gmail), notification);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(r.saved).toBe(1);
    expect(store.expenses.has('bad')).toBe(false);
  });

  it('a Gmail failure other than 404 propagates', async () => {
    await store.setHistoryId('400');
    const gmail = fakeGmail({});
    gmail.listHistory.mockRejectedValue(new Error('503 backend error'));
    await expect(processNotification(deps(gmail), notification)).rejects.toThrow('503');
    expect(await store.getHistoryId()).toBe('400');
  });

  it('an expired history (HistoryExpiredError) falls back to reconcile and resets the historyId', async () => {
    await store.setHistoryId('10');
    const gmail = fakeGmail({ m1: msg('m1') });
    gmail.listHistory.mockRejectedValue(new HistoryExpiredError());
    const r = await processNotification(deps(gmail), notification);
    expect(gmail.listMessages).toHaveBeenCalledTimes(1);
    expect(r.saved).toBe(1);
    expect(await store.getHistoryId()).toBe('500');
  });

  it('does not move the historyId backwards on an old notification', async () => {
    await store.setHistoryId('800');
    const gmail = fakeGmail({ m1: msg('m1') });
    const r = await processNotification(deps(gmail), { ...notification, historyId: '700' });
    expect(r.saved).toBe(0);
    expect(gmail.listHistory).not.toHaveBeenCalled();
    expect(await store.getHistoryId()).toBe('800');
  });
});

describe('rejected purchases', () => {
  it('saves a rejected purchase marked as rejected', async () => {
    await store.setHistoryId('400');
    const rejectedHtml = readFileSync(new URL('./fixtures/approved-purchase-zero-amount.html', import.meta.url), 'utf8');
    const r = await processNotification(deps(fakeGmail({ rej: msg('rej', { html: rejectedHtml }) })), notification);
    expect(r.saved).toBe(1);
    expect(store.expenses.get('rej')).toMatchObject({ status: 'rejected', merchant: 'SEGUROS EJEMPLO', amount: 0 });
  });
});

describe('permanent errors do not block progress', () => {
  it('a deleted message (404 on getMessage) is skipped and the historyId advances', async () => {
    await store.setHistoryId('400');
    const gmail = fakeGmail({ deleted: msg('deleted'), m2: msg('m2') });
    gmail.getMessage.mockImplementation(async (id) => {
      if (id === 'deleted') throw Object.assign(new Error('Not Found'), { code: 404 });
      return msg(id);
    });
    const r = await processNotification(deps(gmail), notification);
    expect(r.saved).toBe(1);
    expect(logger.error).not.toHaveBeenCalled();
    expect(await store.getHistoryId()).toBe('500');
  });

  it('an email from another sender without text/html is ignored without an alert', async () => {
    await store.setHistoryId('400');
    const odd = msg('odd', { from: 'friend@other.com' });
    odd.payload.parts = [{ mimeType: 'text/plain', body: { data: Buffer.from('hello').toString('base64url') } }];
    const r = await processNotification(deps(fakeGmail({ odd })), notification);
    expect(r.saved).toBe(0);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('reconcile', () => {
  it('saves missing emails and does not duplicate existing ones', async () => {
    const gmail = fakeGmail({ m1: msg('m1'), m2: msg('m2') });
    await store.saveExpense('m1', { merchant: 'previous' });
    const r = await reconcile(deps(gmail));
    expect(r.saved).toBe(1);
    expect(store.expenses.get('m1').merchant).toBe('previous');
    expect(gmail.listMessages).toHaveBeenCalledWith('label:card-expenses newer_than:3d');
  });
});

describe('reconcile with a custom window', () => {
  it('searches the given number of days', async () => {
    const gmail = fakeGmail({});
    await reconcile(deps(gmail), { days: 35 });
    expect(gmail.listMessages).toHaveBeenCalledWith('label:card-expenses newer_than:35d');
  });
});

describe('reconcile with a label name that contains spaces', () => {
  it('uses hyphens in the Gmail search, as Gmail requires', async () => {
    const gmail = fakeGmail({});
    await reconcile({ gmail, store, config: { ...config, labelName: 'Gastos BBVA' }, logger });
    expect(gmail.listMessages).toHaveBeenCalledWith('label:Gastos-BBVA newer_than:3d');
  });
});

describe('renewWatch', () => {
  it('stores the initial historyId only if there was none', async () => {
    const gmail = fakeGmail({});
    await renewWatch(deps(gmail));
    expect(await store.getHistoryId()).toBe('100');
    store.setHistoryId.mockClear();
    await store.setHistoryId('300');
    gmail.startWatch.mockResolvedValue({ historyId: '999' });
    await renewWatch(deps(gmail));
    expect(await store.getHistoryId()).toBe('300');
    expect(gmail.startWatch).toHaveBeenCalledTimes(2);
  });
});
