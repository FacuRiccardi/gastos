// JSON (de)serialization of Firestore documents for the local dump. Firestore Timestamps are
// written as {"__ts": "<ISO>"} and restored on load; everything else is plain JSON.
import { Timestamp } from 'firebase-admin/firestore';

export const COLLECTIONS = [
  'expenses', 'categories', 'accounts', 'cards', 'cycles', 'merchantCategories',
  'fixedTypes', 'fixedExpenses', 'exchangeRates', 'spendingCaps', 'incomes', 'savings',
];

export function encode(value) {
  if (value instanceof Timestamp) return { __ts: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

export function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if (typeof value.__ts === 'string' && Object.keys(value).length === 1) {
      return Timestamp.fromDate(new Date(value.__ts));
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}
