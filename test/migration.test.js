import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { migrate } from '../scripts/lib/migration.js';

const ts = (iso) => Timestamp.fromDate(new Date(iso));

const expense = (id, over = {}) => ({
  id,
  data: {
    purchaseDate: ts('2026-10-15T03:00:00Z'),
    receivedAt: ts('2026-10-15T12:00:00Z'),
    merchant: 'KIOSCO',
    amount: 100,
    currency: 'ARS',
    cardLast4: '1111',
    cardType: 'credit',
    cardHolder: 'FACUNDO',
    status: 'approved',
    ...over,
  },
});

const base = (over = {}) => ({
  expenses: [], categories: [], accounts: [], cards: [], cycles: [], merchantCategories: [],
  fixedTypes: [], fixedExpenses: [], exchangeRates: [], spendingCaps: [], incomes: [], savings: [],
  ...over,
});

describe('migrate', () => {
  it('puts a purchase of 31/10 at 00:00 Buenos Aires in 2026-10', () => {
    const out = migrate(base({ expenses: [expense('a', { purchaseDate: ts('2026-10-31T03:00:00Z') })] }));
    expect(Object.keys(out.months)).toEqual(['2026-10']);
    expect(out.months['2026-10'].purchases.a.merchant).toBe('KIOSCO');
    expect(out.config.months.list).toEqual(['2026-10']);
  });

  it('moves categoryId to edits and leaves purchases without it', () => {
    const out = migrate(base({
      categories: [{ id: 'food', data: { name: 'comida', color: '#fff' } }],
      expenses: [expense('a', { categoryId: 'food' })],
    }));
    const month = out.months['2026-10'];
    expect(month.edits.a).toEqual({ category: 'food' });
    expect(month.purchases.a).not.toHaveProperty('categoryId');
    expect(Object.keys(month.purchases.a).sort()).toEqual([
      'amount', 'cardHolder', 'cardLast4', 'cardType', 'currency', 'merchant', 'purchaseDate', 'receivedAt', 'status',
    ]);
    expect(out.uncategorized.items).toEqual({});
  });

  it('lists approved purchases without a category or with a missing one as uncategorized, never rejected ones', () => {
    const out = migrate(base({
      categories: [{ id: 'food', data: { name: 'comida', color: '#fff' } }],
      expenses: [
        expense('none'),
        expense('missing', { categoryId: 'gone' }),
        expense('rejected', { status: 'rejected' }),
        expense('rejectedGone', { status: 'rejected', categoryId: 'gone' }),
        expense('ok', { categoryId: 'food' }),
      ],
    }));
    expect(Object.keys(out.uncategorized.items).sort()).toEqual(['missing', 'none']);
    expect(out.uncategorized.items.none).toEqual({
      month: '2026-10',
      merchant: 'KIOSCO',
      amount: 100,
      currency: 'ARS',
      purchaseDate: ts('2026-10-15T03:00:00Z'),
      cardLast4: '1111',
      cardType: 'credit',
      cardHolder: 'FACUNDO',
    });
    expect(out.months['2026-10'].edits).toEqual({ ok: { category: 'food' } });
  });

  it('fills rate from the latest earlier month, else the latest loaded, and marks it inherited', () => {
    const out = migrate(base({
      exchangeRates: [
        { id: '2025-12', data: { rate: 1400 } },
        { id: '2026-06', data: { rate: 1200 } },
        { id: '2026-08', data: { rate: 1300 } },
      ],
      incomes: [
        { id: 'i1', data: { amount: 1, currency: 'USD', date: '2025-11-03', owner: 'Facu' } },
        { id: 'i2', data: { amount: 1, currency: 'USD', date: '2026-07-03', owner: 'Facu' } },
        { id: 'i3', data: { amount: 1, currency: 'USD', date: '2026-08-03', owner: 'Facu' } },
      ],
    }));
    const m = out.months;
    expect([m['2025-11'].rate, m['2025-11'].rateInherited]).toEqual([1300, true]);
    expect([m['2026-07'].rate, m['2026-07'].rateInherited]).toEqual([1200, true]);
    expect([m['2026-08'].rate, m['2026-08'].rateInherited]).toEqual([1300, false]);
    expect([m['2025-12'].rate, m['2025-12'].rateInherited]).toEqual([1400, false]);
  });

  it('fills cap only from earlier months', () => {
    const out = migrate(base({
      spendingCaps: [{ id: '2026-10', data: { amount: 2500000 } }],
      incomes: [
        { id: 'i1', data: { amount: 1, currency: 'ARS', date: '2026-09-03', owner: 'Facu' } },
        { id: 'i2', data: { amount: 1, currency: 'ARS', date: '2026-11-03', owner: 'Facu' } },
      ],
    }));
    const m = out.months;
    expect([m['2026-09'].cap, m['2026-09'].capInherited]).toEqual([null, false]);
    expect([m['2026-10'].cap, m['2026-10'].capInherited]).toEqual([2500000, false]);
    expect([m['2026-11'].cap, m['2026-11'].capInherited]).toEqual([2500000, true]);
    expect([m['2026-09'].rate, m['2026-09'].rateInherited]).toEqual([null, false]);
  });

  it('builds seenCards with the holder and day of the latest purchase', () => {
    const out = migrate(base({
      expenses: [
        expense('old', { purchaseDate: ts('2026-09-10T03:00:00Z'), cardHolder: 'MAILEN' }),
        expense('new', { purchaseDate: ts('2026-11-01T02:59:00Z'), cardHolder: 'FACUNDO' }),
        expense('debit', { cardType: 'debit', purchaseDate: ts('2026-10-02T03:00:00Z') }),
      ],
    }));
    expect(out.config.cards.seenCards).toEqual({
      '1111_credit': { last4: '1111', type: 'credit', holder: 'FACUNDO', lastSeen: '2026-10-31' },
      '1111_debit': { last4: '1111', type: 'debit', holder: 'FACUNDO', lastSeen: '2026-10-02' },
    });
  });

  it('keeps installment, originalDate and source when present and omits them when absent', () => {
    const out = migrate(base({
      expenses: [
        expense('full', { installment: '02/03', originalDate: '2026-10-06', source: 'excel' }),
        expense('plain'),
      ],
    }));
    const { purchases } = out.months['2026-10'];
    expect(purchases.full).toMatchObject({ installment: '02/03', originalDate: '2026-10-06', source: 'excel' });
    expect(Object.keys(purchases.plain).sort()).toEqual([
      'amount', 'cardHolder', 'cardLast4', 'cardType', 'currency', 'merchant', 'purchaseDate', 'receivedAt', 'status',
    ]);
  });

  it('shapes incomes, savings, fixed and config documents', () => {
    const out = migrate(base({
      accounts: [{ id: 'acc', data: { name: 'BBVA', owner: 'FACUNDO' } }],
      cards: [{ id: '1111_credit', data: { last4: '1111', type: 'credit', holder: 'FACUNDO', accountId: 'acc' } }],
      cycles: [{ id: 'acc_2026-10-25', data: { accountId: 'acc', closingDate: '2026-10-25', dueDate: '2026-11-05' } }],
      categories: [{ id: 'food', data: { name: 'comida', color: '#fff' } }],
      fixedTypes: [{ id: 't1', data: { name: 'Clases' } }, { id: 't2', data: { name: 'Gym', disabled: true } }],
      merchantCategories: [{ id: 'k', data: { merchant: 'KIOSCO', categoryId: 'food' } }],
      fixedExpenses: [{ id: 't1_2026-02', data: { typeId: 't1', month: '2026-02', amount: 120000, source: 'x' } }],
      incomes: [{ id: 'i', data: { amount: 5, currency: 'USD', date: '2026-02-01', source: 'x', owner: 'Facu' } }],
      savings: [{ id: 's', data: { amount: 7, currency: 'USD', date: '2026-02-01', source: 'x' } }],
    }));
    expect(out.months['2026-02']).toEqual({
      purchases: {},
      edits: {},
      incomes: { i: { amount: 5, currency: 'USD', date: '2026-02-01', owner: 'Facu' } },
      savings: { s: { amount: 7, currency: 'USD', date: '2026-02-01' } },
      fixed: { t1: 120000 },
      rate: null,
      rateInherited: false,
      cap: null,
      capInherited: false,
    });
    expect(out.config.cards.accounts).toEqual({ acc: { name: 'BBVA', owner: 'FACUNDO' } });
    expect(out.config.cards.cards).toEqual({
      '1111_credit': { last4: '1111', type: 'credit', holder: 'FACUNDO', accountId: 'acc' },
    });
    expect(out.config.cards.cycles).toEqual({
      'acc_2026-10-25': { accountId: 'acc', closingDate: '2026-10-25', dueDate: '2026-11-05' },
    });
    expect(out.config.categories.items).toEqual({ food: { name: 'comida', color: '#fff', archived: false } });
    expect(out.config.fixedTypes.items).toEqual({
      t1: { name: 'Clases', disabled: false },
      t2: { name: 'Gym', disabled: true },
    });
    expect(out.config.merchants.items).toEqual({ k: { merchant: 'KIOSCO', categoryId: 'food' } });
  });

  it('counts what it read and wrote', () => {
    const out = migrate(base({
      categories: [{ id: 'food', data: { name: 'comida', color: '#fff' } }],
      expenses: [
        expense('a', { categoryId: 'food' }),
        expense('b'),
        expense('c', { purchaseDate: ts('2026-09-10T12:00:00Z'), status: 'rejected' }),
      ],
      incomes: [{ id: 'i', data: { amount: 5, currency: 'USD', date: '2026-02-01', owner: 'Facu' } }],
      savings: [{ id: 's', data: { amount: 7, currency: 'USD', date: '2026-02-01' } }],
      fixedExpenses: [{ id: 'f', data: { typeId: 't1', month: '2026-03', amount: 9 } }],
    }));
    const total = Object.values(out.months).reduce((n, m) => n + Object.keys(m.purchases).length, 0);
    expect(total).toBe(3);
    expect(out.counts).toEqual({
      expenses: 3, categories: 1, accounts: 0, cards: 0, cycles: 0, merchantCategories: 0,
      fixedTypes: 0, fixedExpenses: 1, exchangeRates: 0, spendingCaps: 0, incomes: 1, savings: 1,
      purchases: 3, edits: 1, uncategorized: 1, fixed: 1, months: 4,
    });
  });

  it('is deterministic', () => {
    const input = () => base({
      categories: [{ id: 'food', data: { name: 'comida', color: '#fff' } }],
      expenses: [expense('a', { categoryId: 'food' }), expense('b', { purchaseDate: ts('2026-08-01T12:00:00Z') })],
      exchangeRates: [{ id: '2026-08', data: { rate: 1300 } }],
    });
    expect(migrate(input())).toEqual(migrate(input()));
  });
});
