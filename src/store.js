import { FieldPath, FieldValue, Timestamp } from '@google-cloud/firestore';
import { inheritSource, monthOfDay } from './months.js';

const STATE_DOC = 'state/sync';
const MERCHANTS_DOC = 'config/merchants';
const MONTHS_DOC = 'config/months';
const CARDS_DOC = 'config/cards';
const UNCATEGORIZED_DOC = 'meta/uncategorized';

const cardKey = (last4, type) => `${last4}_${type}`;

export function createStore(db) {
  return {
    // Category the household chose for this merchant key (see merchantKey), or null.
    async getMerchantCategory(key) {
      if (!key) return null;
      const snap = await db.doc(MERCHANTS_DOC).get();
      return snap.exists ? (snap.data().items?.[key]?.categoryId ?? null) : null;
    },

    // Returns true if the purchase was saved, false if it already existed (never overwrites).
    async savePurchase(id, purchase, categoryId) {
      const month = monthOfDay(purchase.purchaseDate);
      // Purchase dates are interpreted in Buenos Aires time (UTC-3, no DST)
      const purchaseDate = Timestamp.fromDate(new Date(`${purchase.purchaseDate}T00:00:00-03:00`));
      const stored = {
        purchaseDate,
        receivedAt: Timestamp.fromDate(purchase.receivedAt),
        merchant: purchase.merchant,
        amount: purchase.amount,
        currency: purchase.currency,
        cardLast4: purchase.cardLast4,
        cardType: purchase.cardType, // 'credit' | 'debit'
        cardHolder: purchase.cardHolder, // first name, as written by the bank
        status: purchase.status, // 'approved' | 'rejected'
      };

      return db.runTransaction(async (tx) => {
        const monthRef = db.doc(`months/${month}`);
        const monthSnap = await tx.get(monthRef);
        const purchases = monthSnap.exists ? (monthSnap.data().purchases ?? {}) : {};
        if (purchases[id]) return false;

        if (monthSnap.exists) {
          const edit = categoryId ? [new FieldPath('edits', id, 'category'), categoryId] : [];
          tx.update(monthRef, new FieldPath('purchases', id), stored, ...edit);
        } else {
          const monthsSnap = await tx.get(db.doc(MONTHS_DOC));
          const source = inheritSource(monthsSnap.exists ? (monthsSnap.data().list ?? []) : [], month);
          const sourceSnap = source ? await tx.get(db.doc(`months/${source}`)) : null;
          const rate = sourceSnap?.exists ? (sourceSnap.data().rate ?? null) : null;
          const cap = sourceSnap?.exists ? (sourceSnap.data().cap ?? null) : null;
          tx.set(monthRef, {
            purchases: { [id]: stored },
            edits: categoryId ? { [id]: { category: categoryId } } : {},
            incomes: {},
            savings: {},
            fixed: {},
            rate,
            rateInherited: rate !== null,
            cap,
            capInherited: cap !== null,
          });
          tx.set(db.doc(MONTHS_DOC), { list: FieldValue.arrayUnion(month) }, { merge: true });
        }

        if (!categoryId && purchase.status === 'approved') {
          const { merchant, amount, currency, cardLast4, cardType, cardHolder } = stored;
          tx.set(
            db.doc(UNCATEGORIZED_DOC),
            { items: { [id]: { month, merchant, amount, currency, purchaseDate, cardLast4, cardType, cardHolder } } },
            { merge: true },
          );
        }

        const cardSeen = Object.values(purchases).some(
          (p) => p.cardLast4 === purchase.cardLast4 && p.cardType === purchase.cardType,
        );
        if (!cardSeen) {
          const seen = { last4: purchase.cardLast4, type: purchase.cardType, holder: purchase.cardHolder, lastSeen: purchase.purchaseDate };
          tx.set(db.doc(CARDS_DOC), { seenCards: { [cardKey(purchase.cardLast4, purchase.cardType)]: seen } }, { merge: true });
        }
        return true;
      });
    },

    async getHistoryId() {
      const snap = await db.doc(STATE_DOC).get();
      return snap.exists ? snap.data().historyId : null;
    },

    // Only moves forward: an older historyId is ignored.
    async setHistoryId(historyId) {
      await db.runTransaction(async (tx) => {
        const ref = db.doc(STATE_DOC);
        const snap = await tx.get(ref);
        const current = snap.exists ? BigInt(snap.data().historyId) : -1n;
        if (BigInt(historyId) > current) tx.set(ref, { historyId: String(historyId) });
      });
    },
  };
}
