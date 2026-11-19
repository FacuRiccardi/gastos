// Pure conversion of the old collections into the month-document structure.
import { monthOfDay, monthOfInstant, inheritSource } from '../../src/months.js';

const BANK_FIELDS = [
  'purchaseDate', 'receivedAt', 'merchant', 'amount', 'currency', 'cardLast4', 'cardType', 'cardHolder', 'status',
];
const UNCATEGORIZED_FIELDS = ['merchant', 'amount', 'currency', 'purchaseDate', 'cardLast4', 'cardType', 'cardHolder'];

const pick = (data, fields) => Object.fromEntries(fields.map((f) => [f, data[f]]));
const byId = (docs, build) => Object.fromEntries(docs.map(({ id, data }) => [id, build(data)]));
const dayOfInstant = (date) => new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function migrate(collections) {
  const read = (name) => collections[name] ?? [];
  const months = {};
  const month = (key) => (months[key] ??= {
    purchases: {}, edits: {}, incomes: {}, savings: {}, fixed: {},
    rate: null, rateInherited: false, cap: null, capInherited: false,
  });

  const categoryIds = new Set(read('categories').map((c) => c.id));
  const uncategorized = {};
  const seenCards = {};

  for (const { id, data } of read('expenses')) {
    const key = monthOfInstant(data.purchaseDate.toDate());
    month(key).purchases[id] = pick(data, BANK_FIELDS);

    if (categoryIds.has(data.categoryId)) {
      month(key).edits[id] = { category: data.categoryId };
    } else if (data.status === 'approved') {
      uncategorized[id] = { month: key, ...pick(data, UNCATEGORIZED_FIELDS) };
    }

    const cardKey = `${data.cardLast4}_${data.cardType}`;
    const seen = seenCards[cardKey];
    if (!seen || data.purchaseDate.toMillis() > seen.millis) {
      seenCards[cardKey] = {
        millis: data.purchaseDate.toMillis(),
        card: {
          last4: data.cardLast4,
          type: data.cardType,
          holder: data.cardHolder,
          lastSeen: dayOfInstant(data.purchaseDate.toDate()),
        },
      };
    }
  }

  for (const { id, data } of read('incomes')) {
    month(monthOfDay(data.date)).incomes[id] = pick(data, ['amount', 'currency', 'date', 'owner']);
  }
  for (const { id, data } of read('savings')) {
    month(monthOfDay(data.date)).savings[id] = pick(data, ['amount', 'currency', 'date']);
  }
  for (const { data } of read('fixedExpenses')) {
    month(data.month).fixed[data.typeId] = data.amount;
  }

  const rates = Object.fromEntries(read('exchangeRates').map(({ id, data }) => [id, data.rate]));
  const caps = Object.fromEntries(read('spendingCaps').map(({ id, data }) => [id, data.amount]));
  for (const key of [...Object.keys(rates), ...Object.keys(caps)]) month(key);

  const list = Object.keys(months).sort();
  const loadedRates = Object.keys(rates).sort();
  const latestLoadedRate = loadedRates.length ? rates[loadedRates[loadedRates.length - 1]] : null;
  for (const key of list) {
    const doc = months[key];
    if (key in rates) {
      doc.rate = rates[key];
    } else {
      const earlier = inheritSource(loadedRates, key);
      doc.rate = earlier !== null ? rates[earlier] : latestLoadedRate;
      doc.rateInherited = doc.rate !== null;
    }
    if (key in caps) {
      doc.cap = caps[key];
    } else {
      const earlier = inheritSource(Object.keys(caps), key);
      doc.cap = earlier !== null ? caps[earlier] : null;
      doc.capInherited = doc.cap !== null;
    }
  }

  const counts = Object.fromEntries(Object.keys(collections).map((name) => [name, collections[name].length]));
  const total = (field) => list.reduce((n, key) => n + Object.keys(months[key][field]).length, 0);
  Object.assign(counts, {
    purchases: total('purchases'),
    edits: total('edits'),
    uncategorized: Object.keys(uncategorized).length,
    incomes: total('incomes'),
    savings: total('savings'),
    fixed: total('fixed'),
    months: list.length,
  });

  return {
    months,
    config: {
      cards: {
        accounts: byId(read('accounts'), (d) => pick(d, ['name', 'owner'])),
        cards: byId(read('cards'), (d) => pick(d, ['last4', 'type', 'holder', 'accountId'])),
        cycles: byId(read('cycles'), (d) => pick(d, ['accountId', 'closingDate', 'dueDate'])),
        seenCards: Object.fromEntries(Object.entries(seenCards).map(([k, v]) => [k, v.card])),
      },
      categories: { items: byId(read('categories'), (d) => ({ name: d.name, color: d.color, archived: false })) },
      fixedTypes: { items: byId(read('fixedTypes'), (d) => ({ name: d.name, disabled: d.disabled ?? false })) },
      merchants: { items: byId(read('merchantCategories'), (d) => pick(d, ['merchant', 'categoryId'])) },
      months: { list },
    },
    uncategorized: { items: uncategorized },
    counts,
  };
}
