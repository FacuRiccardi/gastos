import { collection, onSnapshot, orderBy, query, Timestamp, type Firestore } from 'firebase/firestore'
import type { Expense } from '@/lib/expense'

// Where the expenses come from. Components receive it through props so tests can use a fake.
export interface ExpensesSource {
  subscribe(onData: (expenses: Expense[]) => void, onError: (error: Error) => void): () => void
}

// Reads the whole `expenses` collection (fine for a few purchases a day) and keeps it in sync.
// Access is enforced by the Firestore rules, not by this code.
export function createFirestoreExpensesSource(db: Firestore): ExpensesSource {
  return {
    subscribe(onData, onError) {
      const q = query(collection(db, 'expenses'), orderBy('purchaseDate', 'desc'))
      return onSnapshot(
        q,
        (snapshot) => {
          onData(
            snapshot.docs.map((doc): Expense => {
              const d = doc.data()
              return {
                id: doc.id,
                purchaseDate: (d.purchaseDate as Timestamp).toDate(),
                receivedAt: (d.receivedAt as Timestamp).toDate(),
                merchant: d.merchant,
                amount: d.amount,
                currency: d.currency,
                cardLast4: d.cardLast4,
                cardType: d.cardType,
                cardHolder: d.cardHolder,
                status: d.status,
                categoryId: d.categoryId ?? null,
              }
            }),
          )
        },
        (error) => onError(error),
      )
    },
  }
}
