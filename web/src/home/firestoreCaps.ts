// Firestore implementation of the monthly spending caps (collection `spendingCaps`, one document per month).
import { collection, deleteDoc, doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import type { CapsApi, CapsSource } from './capsApi'

export function createFirestoreCapsSource(db: Firestore): CapsSource {
  return {
    subscribe(onData, onError) {
      return onSnapshot(
        collection(db, 'spendingCaps'),
        (snapshot) => onData(Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data().amount as number]))),
        (error) => onError(error),
      )
    },
  }
}

export function createFirestoreCapsApi(db: Firestore): CapsApi {
  return {
    async save(month, amount) {
      await setDoc(doc(db, 'spendingCaps', month), { amount })
    },
    async remove(month) {
      await deleteDoc(doc(db, 'spendingCaps', month))
    },
  }
}
