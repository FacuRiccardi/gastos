import { describe, it, expect } from 'vitest';
import { capFor, currentPeriodSpend, latestRate } from '../src/periodSpend.js';

const at = (day) => new Date(`${day}T15:00:00Z`);
const exp = (day, amount, extra = {}) => ({
  purchaseDate: at(day),
  amount,
  currency: 'ARS',
  cardLast4: '1111',
  cardType: 'credit',
  ...extra,
});
const base = (over = {}) => ({
  expenses: [],
  accounts: [{ id: 'a' }],
  cards: [{ last4: '1111', type: 'credit', accountId: 'a' }],
  cycles: [
    { accountId: 'a', closingDate: '2026-10-05' },
    { accountId: 'a', closingDate: '2026-11-05' },
  ],
  rates: {},
  today: '2026-11-04',
  ...over,
});

describe('currentPeriodSpend', () => {
  it('counts the closing day in the ending period and leaves out the next one', () => {
    const r = currentPeriodSpend(
      base({ expenses: [exp('2026-10-06', 100), exp('2026-11-05', 50), exp('2026-11-06', 7), exp('2026-10-05', 3)] }),
    );
    expect(r).toEqual({ month: '2026-11', total: 150 });
  });

  it('on the closing day it is still the period ending that day', () => {
    const r = currentPeriodSpend(base({ today: '2026-11-05', expenses: [exp('2026-11-05', 50)] }));
    expect(r).toEqual({ month: '2026-11', total: 50 });
  });

  it('excludes rejected, debit and cards of other or unknown accounts', () => {
    const r = currentPeriodSpend(
      base({
        accounts: [{ id: 'a' }, { id: 'b' }],
        cards: [
          { last4: '1111', type: 'credit', accountId: 'a' },
          { last4: '2222', type: 'debit', accountId: 'a' },
          { last4: '3333', type: 'credit', accountId: 'b' },
        ],
        expenses: [
          exp('2026-10-10', 100),
          exp('2026-10-10', 1000, { status: 'rejected' }),
          exp('2026-10-10', 2000, { cardLast4: '2222', cardType: 'debit' }),
          exp('2026-10-10', 4000, { cardLast4: '9999' }),
          exp('2026-10-10', 8000, { cardLast4: '3333' }),
        ],
      }),
    );
    // b has no cycles: its open tab has the 8000
    expect(r.total).toBe(8100);
  });

  it('converts USD with the latest rate and ignores other currencies', () => {
    const e = [exp('2026-10-10', 10, { currency: 'USD' }), exp('2026-10-10', 99, { currency: 'EUR' })];
    expect(currentPeriodSpend(base({ expenses: e, rates: { '2026-08': 1000, '2026-09': 1200 } })).total).toBe(12000);
    expect(currentPeriodSpend(base({ expenses: e, rates: {} })).total).toBe(0);
  });

  it('an account without cycles counts in its open tab', () => {
    const r = currentPeriodSpend(base({ cycles: [], expenses: [exp('2020-01-01', 5), exp('2026-11-01', 6)] }));
    expect(r).toEqual({ month: '2026-11', total: 11 });
  });

  it('an account past its last closing counts only later purchases and does not set the month', () => {
    const r = currentPeriodSpend(
      base({
        accounts: [{ id: 'a' }, { id: 'b' }],
        cards: [
          { last4: '1111', type: 'credit', accountId: 'a' },
          { last4: '2222', type: 'credit', accountId: 'b' },
        ],
        cycles: [
          { accountId: 'a', closingDate: '2026-10-05' },
          { accountId: 'a', closingDate: '2026-11-05' },
          { accountId: 'b', closingDate: '2026-09-01' },
          { accountId: 'b', closingDate: '2026-10-01' },
        ],
        expenses: [exp('2026-10-10', 10), exp('2026-09-20', 500, { cardLast4: '2222' }), exp('2026-10-20', 20, { cardLast4: '2222' })],
      }),
    );
    expect(r).toEqual({ month: '2026-11', total: 30 });
  });

  it('the month is the one of the latest period end among accounts', () => {
    const r = currentPeriodSpend(
      base({
        accounts: [{ id: 'a' }, { id: 'b' }],
        cycles: [
          { accountId: 'a', closingDate: '2026-10-25' },
          { accountId: 'a', closingDate: '2026-11-25' },
          { accountId: 'b', closingDate: '2026-11-20' },
          { accountId: 'b', closingDate: '2026-12-02' },
        ],
        today: '2026-11-28',
      }),
    );
    expect(r.month).toBe('2026-12');
  });

  it('is null without accounts', () => {
    expect(currentPeriodSpend(base({ accounts: [], cards: [], cycles: [] }))).toBeNull();
  });
});

describe('capFor', () => {
  it('falls back to the latest earlier cap', () => {
    expect(capFor('2026-12', { '2026-10': 500 })).toEqual({ amount: 500, from: '2026-10' });
  });
  it('prefers its own month', () => {
    expect(capFor('2026-12', { '2026-10': 500, '2026-12': 700 })).toEqual({ amount: 700, from: '2026-12' });
  });
  it('skips earlier zero amounts', () => {
    expect(capFor('2026-12', { '2026-09': 300, '2026-10': 0 })).toEqual({ amount: 300, from: '2026-09' });
  });
  it('is null when there is none', () => {
    expect(capFor('2026-12', {})).toBeNull();
    expect(capFor('2026-01', { '2026-10': 500 })).toBeNull();
  });
});

describe('latestRate', () => {
  it('ignores non-positive rates', () => {
    expect(latestRate({ '2026-01': 900, '2026-03': 0 })).toBe(900);
    expect(latestRate({})).toBe(0);
  });
});
