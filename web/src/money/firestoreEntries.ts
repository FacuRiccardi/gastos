// Firestore implementation for incomes and savings. Access is enforced by the Firestore rules.
import { addDoc, collection, deleteDoc, doc, onSnapshot, type Firestore } from 'firebase/firestore'
import type { EntriesApi, EntriesSource, Entry, EntryKind } from './entries'

export function createFirestoreEntriesSource(db: Firestore, kind: EntryKind): EntriesSource {
  return {
    subscribe(onData, onError) {
      return onSnapshot(
        collection(db, kind),
        (snapshot) =>
          onData(
            snapshot.docs
              .map((d): Entry => ({ id: d.id, amount: d.data().amount as number, currency: d.data().currency, date: d.data().date as string, ...(d.data().owner ? { owner: d.data().owner } : {}) }))
              .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
          ),
        (error) => onError(error),
      )
    },
  }
}

export function createFirestoreEntriesApi(db: Firestore, kind: EntryKind): EntriesApi {
  return {
    async add(entry) {
      const ref = await addDoc(collection(db, kind), { amount: entry.amount, currency: entry.currency, date: entry.date, ...(entry.owner ? { owner: entry.owner } : {}) })
      return ref.id
    },
    async remove(id) {
      await deleteDoc(doc(db, kind, id))
    },
  }
}
