import { Timestamp } from '@google-cloud/firestore';

const EXPENSES = 'expenses';
const STATE_DOC = 'state/sync';
const MERCHANTS = 'merchantCategories';

export function createStore(db) {
  return {
    // Returns true if the expense was created, false if it already existed (never overwrites).
    async saveExpense(id, expense) {
      try {
        await db.collection(EXPENSES).doc(id).create({
          // Purchase dates are interpreted in Buenos Aires time (UTC-3, no DST)
          purchaseDate: Timestamp.fromDate(new Date(`${expense.purchaseDate}T00:00:00-03:00`)),
          receivedAt: Timestamp.fromDate(expense.receivedAt),
          merchant: expense.merchant,
          amount: expense.amount,
          currency: expense.currency,
          cardLast4: expense.cardLast4,
          cardType: expense.cardType, // 'credit' | 'debit'
          cardHolder: expense.cardHolder, // first name, as written by the bank
          status: expense.status, // 'approved' | 'rejected'
          // Only when the merchant is already in the dictionary; otherwise the purchase stays uncategorized.
          ...(expense.categoryId ? { categoryId: expense.categoryId } : {}),
        });
        return true;
      } catch (e) {
        if (e.code === 6) return false; // ALREADY_EXISTS
        throw e;
      }
    },

    // Category the household chose for this merchant key (see merchantKey), or null.
    async getMerchantCategory(key) {
      if (!key) return null;
      const snap = await db.collection(MERCHANTS).doc(key).get();
      return snap.exists ? (snap.data().categoryId ?? null) : null;
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

    // Sums approved expenses (rejected ones are excluded; documents without status count as approved).
    async sumByRange(from, to) {
      const q = db
        .collection(EXPENSES)
        .where('purchaseDate', '>=', Timestamp.fromDate(from))
        .where('purchaseDate', '<', Timestamp.fromDate(to));
      const snap = await q.select('amount', 'status').get();
      return snap.docs.reduce((total, d) => (d.data().status === 'rejected' ? total : total + d.data().amount), 0);
    },
  };
}
