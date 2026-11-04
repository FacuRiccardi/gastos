// Backend port of the web's "current period" spending (web/src/expenses/statements.ts and
// web/src/home/homePeriods.ts), so the server computes what the home screen shows.
// Differences by design: only the current group; USD uses the latest loaded rate; plain-object input.

import { addDays, buenosAiresDay } from './dates.js';

const r2 = (n) => Math.round(n * 100) / 100;

/** The latest loaded exchange rate (highest month key with a rate > 0); 0 when there is none. */
export function latestRate(rates) {
  const month = Object.keys(rates)
    .filter((m) => rates[m] > 0)
    .sort()
    .pop();
  return month ? rates[month] : 0;
}

/** The cap of a month: its own, or else the latest one defined before it. */
export function capFor(month, caps) {
  if (caps[month]) return { amount: caps[month], from: month };
  const earlier = Object.keys(caps)
    .filter((m) => m < month && caps[m] > 0)
    .sort()
    .pop();
  return earlier ? { amount: caps[earlier], from: earlier } : null;
}

const sortedUnique = (dates) => [...new Set(dates)].sort();

// Same rule as the web's tabIdFor: 'open', 'old' or the period end that contains the day.
function tabIdFor(day, dates) {
  if (dates.length === 0 || day > dates[dates.length - 1]) return 'open';
  if (day <= dates[0]) return 'old';
  return `period:${dates.find((closing) => day <= closing)}`;
}

/**
 * What the credit cards of the accounts owe in the period each account is in today, in pesos
 * (USD at the latest rate), and the month it is counted in. Null when the web shows no current group.
 */
export function currentPeriodSpend({ expenses, accounts, cards, cycles, rates, today }) {
  const rate = latestRate(rates);
  const current = [];
  for (const account of accounts) {
    const dates = sortedUnique(cycles.filter((c) => c.accountId === account.id).map((c) => c.closingDate));
    const creditKeys = new Set(
      cards.filter((c) => c.accountId === account.id && c.type === 'credit').map((c) => `${c.last4}_${c.type}`),
    );
    // period containing today, else the open tab (which exists with purchases after the last closing or without dates)
    let period = null;
    for (let i = 1; i < dates.length; i++) {
      if (addDays(dates[i - 1], 1) <= today && today <= dates[i]) period = { end: dates[i] };
    }
    const wanted = period ? `period:${period.end}` : 'open';
    const totals = {};
    let count = 0;
    for (const e of expenses) {
      if (!creditKeys.has(`${e.cardLast4}_${e.cardType}`)) continue;
      if (tabIdFor(buenosAiresDay(e.purchaseDate), dates) !== wanted) continue;
      count++;
      if (e.status !== 'rejected') totals[e.currency] = r2((totals[e.currency] ?? 0) + e.amount);
    }
    if (!period && count === 0 && dates.length > 0) continue;
    current.push({ end: period ? period.end : null, total: r2((totals.ARS ?? 0) + (rate ? (totals.USD ?? 0) * rate : 0)) });
  }
  if (current.length === 0) return null;
  const end = current
    .map((i) => i.end)
    .filter(Boolean)
    .sort()
    .pop();
  return { month: (end ?? today).slice(0, 7), total: r2(current.reduce((sum, i) => sum + i.total, 0)) };
}
