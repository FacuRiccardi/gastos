import { describe, it, expect } from 'vitest';
import { currentPeriodSpend, latestRate } from '../src/periodSpend.js';
import { buildAccountViews } from '@/expenses/statements';
import { buildHomePeriods } from '@/home/homePeriods';

const at = (day) => new Date(`${day}T15:00:00Z`);
let n = 0;
const exp = (day, amount, extra = {}) => ({
  id: `e${n++}`,
  purchaseDate: at(day),
  receivedAt: at(day),
  merchant: 'x',
  amount,
  currency: 'ARS',
  cardLast4: '1111',
  cardType: 'credit',
  cardHolder: 'H',
  ...extra,
});

const accounts = [
  { id: 'a', name: 'Alpha', owner: 'x' },
  { id: 'b', name: 'Beta', owner: 'x' },
  { id: 'c', name: 'Gamma', owner: 'x' },
];
const cards = [
  { last4: '1111', type: 'credit', holder: 'H', accountId: 'a' },
  { last4: '2222', type: 'credit', holder: 'H', accountId: 'b' },
  { last4: '3333', type: 'credit', holder: 'H', accountId: 'c' },
  { last4: '4444', type: 'debit', holder: 'H', accountId: 'a' },
];
const cyc = (accountId, closingDate) => ({ accountId, closingDate, dueDate: null });
const cycles = [
  cyc('a', '2026-09-05'), cyc('a', '2026-10-05'), cyc('a', '2026-11-05'),
  cyc('b', '2026-09-20'), cyc('b', '2026-10-20'), cyc('b', '2026-11-20'),
];
const expenses = [
  exp('2026-10-06', 100.1), exp('2026-11-05', 50.2), exp('2026-11-06', 7), exp('2026-10-05', 3),
  exp('2026-10-10', 10, { currency: 'USD' }), exp('2026-10-10', 5, { currency: 'EUR' }),
  exp('2026-10-10', 999, { status: 'rejected' }), exp('2026-10-10', 888, { cardLast4: '4444', cardType: 'debit' }),
  exp('2026-10-10', 777, { cardLast4: '9999' }), exp('2026-10-25', 33.33, { cardLast4: '2222' }),
  exp('2026-11-20', 1.11, { cardLast4: '2222' }), exp('2026-12-01', 5, { cardLast4: '2222' }),
  exp('2020-01-01', 2, { cardLast4: '3333' }), exp('2026-11-02', 4.44, { cardLast4: '3333' }),
  exp('2026-11-02', 9, { cardLast4: '3333', currency: 'USD' }),
];
const rates = { '2026-08': 1000, '2026-09': 1200 };

function web(accts, cds, cys, exps, today, ratesMap) {
  const data = { accounts: accts, cards: cds, cycles: cys };
  const g = buildHomePeriods(buildAccountViews(exps, data), cys, today, ratesMap).current;
  return g ? { month: g.month, total: g.total } : null;
}
function mine(accts, cds, cys, exps, today, ratesMap) {
  return currentPeriodSpend({
    expenses: exps,
    accounts: accts.map((a) => ({ id: a.id })),
    cards: cds,
    cycles: cys.map(({ accountId, closingDate }) => ({ accountId, closingDate })),
    rates: ratesMap,
    today,
  });
}
// the web's rateFor returns the latest rate for any month when the map has a single entry
const single = (r) => {
  const month = Object.keys(r).filter((m) => r[m] > 0).sort().pop();
  return month ? { [month]: r[month] } : {};
};

describe('currentPeriodSpend parity with the web', () => {
  const scenarios = {
    'all accounts mid period': [accounts, cards, cycles, expenses, '2026-11-04'],
    'closing day of a': [accounts, cards, cycles, expenses, '2026-11-05'],
    'closing day of b': [accounts, cards, cycles, expenses, '2026-11-20'],
    'after every closing (open tabs)': [accounts, cards, cycles, expenses, '2026-12-02'],
    'before every period': [accounts, cards, cycles, expenses, '2026-01-10'],
    'a month with no periods': [accounts, cards, cycles.filter((c) => c.accountId === 'a'), expenses, '2026-12-15'],
    'no accounts': [[], [], [], expenses, '2026-11-04'],
    'accounts without cycles': [accounts, cards, [], expenses, '2026-11-04'],
    'single closing date': [accounts, cards, [cyc('a', '2026-10-05')], expenses, '2026-11-04'],
  };
  for (const [name, args] of Object.entries(scenarios)) {
    for (const [label, r] of [['with rates', rates], ['without rates', {}]]) {
      it(`${name} (${label})`, () => {
        const [a, c, y, e, today] = args;
        expect(mine(a, c, y, e, today, r)).toEqual(web(a, c, y, e, today, single(r)));
      });
    }
  }

  it('pins the intended difference: latest rate instead of the month rate', () => {
    const r = { '2026-10': 1000, '2026-11': 1500, '2026-12': 1800 };
    const e = [exp('2026-10-10', 10, { currency: 'USD' })];
    const args = [accounts.slice(0, 1), cards, cycles, e, '2026-11-04'];
    expect(latestRate(r)).toBe(1800);
    expect(web(...args, r)).toEqual({ month: '2026-11', total: 15000 });
    expect(mine(...args, r)).toEqual({ month: '2026-11', total: 18000 });
  });
});
