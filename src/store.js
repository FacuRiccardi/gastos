import { Timestamp } from '@google-cloud/firestore';

const EXPENSES = 'expenses';
const STATE_DOC = 'state/sync';
const MERCHANTS = 'merchantCategories';
const CAP_ALERTS = 'capAlerts';
const PUSH_TOKENS = 'pushTokens';

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

    // Everything currentPeriodSpend needs to compute the spend against the monthly cap.
    async getCapContext() {
      const [expSnap, accSnap, cardSnap, cycleSnap, rateSnap, capSnap] = await Promise.all(
        [EXPENSES, 'accounts', 'cards', 'cycles', 'exchangeRates', 'spendingCaps'].map((c) => db.collection(c).get()),
      );
      return {
        expenses: expSnap.docs.map((d) => {
          const { purchaseDate, amount, currency, cardLast4, cardType, status } = d.data();
          return { purchaseDate: purchaseDate.toDate(), amount, currency, cardLast4, cardType, status };
        }),
        accounts: accSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        cards: cardSnap.docs.map((d) => d.data()),
        cycles: cycleSnap.docs.map((d) => d.data()),
        rates: Object.fromEntries(rateSnap.docs.map((d) => [d.id, d.data().rate])),
        caps: Object.fromEntries(capSnap.docs.map((d) => [d.id, d.data().amount])),
      };
    },

    // True only for the caller that raises the stored level; concurrent/duplicate calls get false.
    async raiseCapAlert(month, { level, total, cap }) {
      return db.runTransaction(async (tx) => {
        const ref = db.collection(CAP_ALERTS).doc(month);
        const snap = await tx.get(ref);
        const last = snap.exists ? snap.data().lastLevel : undefined;
        if (last !== undefined && level <= last) return false;
        tx.set(ref, { lastLevel: level, total, cap, announcedAt: Timestamp.now() });
        return true;
      });
    },

    async listPushTokens() {
      const snap = await db.collection(PUSH_TOKENS).get();
      return snap.docs.map((d) => d.id);
    },

    async deletePushTokens(tokens) {
      if (!tokens.length) return;
      const batch = db.batch();
      for (const t of tokens) batch.delete(db.collection(PUSH_TOKENS).doc(t));
      await batch.commit();
    },
  };
}
