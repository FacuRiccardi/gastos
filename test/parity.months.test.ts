import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decode } from '../scripts/lib/dumpFormat.js';
import { migrate } from '../scripts/lib/migration.js';
import { toMonthData, toAppConfig, expensesOf, ratesOf, capsOf, fixedOf, entriesOf } from '../web/src/data/monthDoc';
import { homeMonths, groupMonths, offeredMonths } from '../web/src/data/monthsFor';
import { monthOfInstant } from '../web/src/data/months';
import type { MonthData } from '../web/src/data/types';
import { buildAccountViews, buildPeriods } from '../web/src/expenses/statements';
import { buildHomePeriods, previousMonthTotal, groupForMonth, capFor, type PeriodGroup } from '../web/src/home/homePeriods';
import { buildBreakdown } from '../web/src/expenses/categoryBreakdown';
import { buildBalance } from '../web/src/balance/balance';
import { addDays } from '../web/src/lib/dates';
import type { CardsData } from '../web/src/cards/cardsApi';
import type { Category } from '../web/src/categories/types';
import type { FixedData } from '../web/src/fixed/fixedApi';
import type { Entry } from '../web/src/money/entries';
import type { Expense } from '../web/src/lib/expense';

const dumpPath = fileURLToPath(new URL('../emulator-data/firestore.json', import.meta.url));
const DUMP_DAY = '2026-11-04';
const LABELS = { uncategorized: 'Sin categoría', minor: 'Otras' };

type Doc = { id: string; data: Record<string, any> };
type Dump = Record<string, Doc[]>;

const newestFirst = (a: { id: string; purchaseDate: Date }, b: { id: string; purchaseDate: Date }) =>
  b.purchaseDate.getTime() - a.purchaseDate.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
const newestEntryFirst = (a: Entry, b: Entry) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es-AR');

function loadOld(dump: Dump) {
  const read = (name: string) => dump[name] ?? [];
  const expenses = read('expenses')
    .map(({ id, data: d }): Expense => ({
      id,
      month: monthOfInstant(d.purchaseDate.toDate()),
      purchaseDate: d.purchaseDate.toDate(),
      receivedAt: d.receivedAt.toDate(),
      merchant: d.merchant,
      amount: d.amount,
      currency: d.currency,
      cardLast4: d.cardLast4,
      cardType: d.cardType,
      cardHolder: d.cardHolder,
      status: d.status,
      categoryId: d.categoryId ?? null,
    }))
    .sort(newestFirst);
  const cards: CardsData = {
    accounts: read('accounts').map(({ id, data: d }) => ({ id, name: d.name, owner: d.owner })),
    cards: read('cards').map(({ data: d }) => ({ last4: d.last4, type: d.type, holder: d.holder, accountId: d.accountId })),
    cycles: read('cycles').map(({ data: d }) => ({ accountId: d.accountId, closingDate: d.closingDate, dueDate: d.dueDate ?? null })),
  };
  const categories: Category[] = read('categories')
    .map(({ id, data: d }) => ({ id, name: d.name, color: d.color, archived: d.archived ?? false }))
    .sort(byName);
  const fixed: FixedData = {
    types: read('fixedTypes').map(({ id, data: d }) => ({ id, name: d.name, disabled: d.disabled === true })).sort(byName),
    entries: read('fixedExpenses').map(({ data: d }) => ({ typeId: d.typeId, month: d.month, amount: d.amount })),
  };
  const entries = (kind: string): Entry[] =>
    read(kind)
      .map(({ id, data: d }): Entry => ({ id, amount: d.amount, currency: d.currency, date: d.date, ...(d.owner ? { owner: d.owner } : {}) }))
      .sort(newestEntryFirst);
  return {
    expenses,
    cards,
    categories,
    fixed,
    incomes: entries('incomes'),
    savings: entries('savings'),
    rates: Object.fromEntries(read('exchangeRates').map(({ id, data: d }) => [id, d.rate as number])),
    caps: Object.fromEntries(read('spendingCaps').map(({ id, data: d }) => [id, d.amount as number])),
  };
}

// The migrated documents in the dump when it has them; otherwise the migration of its old collections.
function loadNew(dump: Dump) {
  if (dump.months?.length && dump.config?.length) {
    const config = Object.fromEntries(dump.config.map(({ id, data }) => [id, data]));
    return {
      months: Object.fromEntries(dump.months.map(({ id, data }) => [id, data])),
      config,
      uncategorized: dump.meta?.find((d) => d.id === 'uncategorized')?.data ?? { items: {} },
    };
  }
  const { months, config, uncategorized } = migrate(dump);
  return { months, config, uncategorized };
}

const groupSummary = (g: PeriodGroup | null) =>
  g && {
    kind: g.kind,
    total: g.total,
    usd: g.usd,
    foreign: g.foreign,
    month: g.month,
    latestDue: g.latestDue,
    rate: g.rate?.rate ?? null,
    expenses: g.expenses.map((e) => e.id),
    accounts: g.accounts.map((a) => ({
      account: a.account.id,
      total: a.total,
      due: a.due,
      cards: a.tab.cards.map((c) => ({ card: `${c.card.last4}_${c.card.type}`, totals: c.totals, count: c.count })),
    })),
  };

const breakdownSummary = (g: PeriodGroup | null, categories: Category[]) => {
  if (!g) return null;
  const b = buildBreakdown(g.expenses, categories, LABELS, g.rate?.rate ?? null);
  return {
    total: Math.round(b.total * 100) / 100,
    hasForeign: b.hasForeign,
    slices: b.slices.map((s) => ({ id: s.id, amount: s.amount, percent: Math.round(s.percent * 100) / 100, top: s.top })),
  };
};

describe.skipIf(!existsSync(dumpPath))('parity between the old collections and the month documents', () => {
  const dump = existsSync(dumpPath) ? (decode(JSON.parse(readFileSync(dumpPath, 'utf8'))) as Dump) : {};
  const old = loadOld(dump);
  const fresh = loadNew(dump);
  const config = toAppConfig(fresh.config);
  const allMonths: MonthData[] = config.months.map((id) => toMonthData(id, fresh.months[id]));
  const monthsById = new Map(allMonths.map((m) => [m.id, m]));
  const oldViews = buildAccountViews(old.expenses, old.cards);

  const select = (ids: string[] | 'all') => (ids === 'all' ? allMonths : ids.map((id) => monthsById.get(id)!).filter(Boolean));
  const newSide = (ids: string[] | 'all') => {
    const months = select(ids);
    return { months, views: buildAccountViews(expensesOf(months), config.cards), rates: ratesOf(months), caps: capsOf(months) };
  };

  const closings = [...new Set(old.cards.cycles.map((c) => c.closingDate))].sort();
  const middles = old.cards.accounts.flatMap((a) =>
    buildPeriods(old.cards.cycles.filter((c) => c.accountId === a.id).map((c) => c.closingDate)).map((p) => {
      const days = Math.round((Date.parse(p.end) - Date.parse(p.start)) / 86400000);
      return addDays(p.start, Math.floor(days / 2));
    }),
  );
  const todays = [...new Set([...closings, ...closings.map((c) => addDays(c, 1)), ...middles, DUMP_DAY])].sort();

  it('uses a dump with data', () => {
    expect(old.expenses.length).toBeGreaterThan(0);
    expect(allMonths.length).toBeGreaterThan(0);
  });

  it('home matches for every closing day, the day after, mid-period and 2026-11-04', () => {
    const compared = { current: 0, closed: 0 };
    for (const today of todays) {
      const ids = homeMonths(config.cards, config.months, today);
      const side = newSide(ids);
      const before = buildHomePeriods(oldViews, old.cards.cycles, today, old.rates);
      const after = buildHomePeriods(side.views, config.cards.cycles, today, side.rates);
      for (const kind of ['current', 'closed'] as const) {
        const o = before[kind];
        const n = after[kind];
        expect(groupSummary(n), `${today} ${kind}`).toEqual(groupSummary(o));
        if (!o || !n) continue;
        compared[kind]++;
        expect(previousMonthTotal(side.views, config.cards.cycles, n.month, today, side.rates), `${today} ${kind} previous`).toEqual(
          previousMonthTotal(oldViews, old.cards.cycles, o.month, today, old.rates),
        );
        expect(capFor(n.month, side.caps)?.amount ?? null, `${today} ${kind} cap`).toBe(capFor(o.month, old.caps)?.amount ?? null);
      }
    }
    expect(compared.current).toBeGreaterThan(0);
    expect(compared.closed).toBeGreaterThan(0);
  });

  it('gastos matches for every offered month', () => {
    const offered = offeredMonths(config.cards, config.months, DUMP_DAY);
    expect(offered.length).toBeGreaterThan(0);
    let compared = 0;
    for (const month of offered) {
      const side = newSide(groupMonths(config.cards, month, config.months));
      const o = groupForMonth(oldViews, old.cards.cycles, month, DUMP_DAY, old.rates);
      const n = groupForMonth(side.views, config.cards.cycles, month, DUMP_DAY, side.rates);
      expect(groupSummary(n), month).toEqual(groupSummary(o));
      if (o && n) compared++;
      expect(previousMonthTotal(side.views, config.cards.cycles, month, DUMP_DAY, side.rates), `${month} previous`).toEqual(
        previousMonthTotal(oldViews, old.cards.cycles, month, DUMP_DAY, old.rates),
      );
      expect(breakdownSummary(n, config.categories), `${month} breakdown`).toEqual(breakdownSummary(o, old.categories));
    }
    expect(compared).toBeGreaterThan(0);
  });

  it('balance matches for every existing month', () => {
    const side = newSide('all');
    const fixed = fixedOf(config.fixedTypes, allMonths);
    const incomes = entriesOf('incomes', allMonths);
    const savings = entriesOf('savings', allMonths);
    const pick = (b: ReturnType<typeof buildBalance>) => ({
      balance: b.balance,
      incomeTotal: b.incomeTotal,
      fixedTotal: b.fixedTotal,
      cardsTotal: b.cardsTotal,
      missingRate: b.missingRate,
      savedThisMonth: b.savedThisMonth,
      savedUntilNow: b.savedUntilNow,
    });
    for (const month of config.months) {
      const o = buildBalance({ month, incomes: old.incomes, savings: old.savings, fixed: old.fixed, rates: old.rates, rateInherited: false, views: oldViews, cycles: old.cards.cycles });
      const n = buildBalance({ month, incomes, savings, fixed, rates: side.rates, rateInherited: false, views: side.views, cycles: config.cards.cycles });
      expect(pick(n), month).toEqual(pick(o));
    }
  });

  it('migration counts match the source collections', () => {
    const count = (field: 'purchases' | 'edits' | 'incomes' | 'savings' | 'fixed') =>
      Object.values(fresh.months).reduce((n: number, m: any) => n + Object.keys(m[field] ?? {}).length, 0);
    const categoryIds = new Set(old.categories.map((c) => c.id));
    const categorized = old.expenses.filter((e) => e.categoryId && categoryIds.has(e.categoryId));
    const pending = old.expenses.filter((e) => !(e.categoryId && categoryIds.has(e.categoryId)) && e.status === 'approved');
    const fixedKeys = new Set(old.fixed.entries.map((e) => `${e.typeId}_${e.month}`));

    expect(count('purchases')).toBe(old.expenses.length);
    expect(expensesOf(allMonths).map((e) => e.id)).toEqual(old.expenses.map((e) => e.id));
    expect(count('edits')).toBe(categorized.length);
    expect(Object.keys(fresh.uncategorized.items ?? {}).sort()).toEqual(pending.map((e) => e.id).sort());
    expect(count('incomes')).toBe(old.incomes.length);
    expect(count('savings')).toBe(old.savings.length);
    expect(count('fixed')).toBe(fixedKeys.size);
    expect(Object.keys(fresh.months).sort()).toEqual(config.months);
    expect(allMonths.filter((m) => m.rate !== null && !m.rateInherited).map((m) => m.id)).toEqual(Object.keys(old.rates).sort());
    expect(allMonths.filter((m) => m.cap !== null && !m.capInherited).map((m) => m.id)).toEqual(Object.keys(old.caps).sort());
    expect(config.cards.accounts).toHaveLength(old.cards.accounts.length);
    expect(config.cards.cards).toHaveLength(old.cards.cards.length);
    expect(config.cards.cycles).toHaveLength(old.cards.cycles.length);
    expect(config.categories).toHaveLength(old.categories.length);
    expect(config.fixedTypes).toHaveLength(old.fixed.types.length);
    expect(config.merchants).toHaveLength((dump.merchantCategories ?? []).length);
  });
});
