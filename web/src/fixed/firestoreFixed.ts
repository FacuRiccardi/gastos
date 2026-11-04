// Firestore implementation of the fixed expenses data layer. Access is enforced by the Firestore rules.
import { addDoc, collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc, type Firestore } from 'firebase/firestore'
import { entryKey, type FixedApi, type FixedEntry, type FixedSource, type FixedType } from './fixedApi'

export function createFirestoreFixedSource(db: Firestore): FixedSource {
  return {
    subscribe(onData, onError) {
      let types: FixedType[] | undefined
      let entries: FixedEntry[] | undefined
      let errored = false
      const emit = () => {
        if (!errored && types && entries) onData({ types, entries })
      }
      const unsubscribers: Array<() => void> = []
      // The first error stops both listeners and is reported once.
      const fail = (error: Error) => {
        if (errored) return
        errored = true
        unsubscribers.forEach((u) => u())
        onError(error)
      }
      unsubscribers.push(
        onSnapshot(
          collection(db, 'fixedTypes'),
          (snapshot) => {
            types = snapshot.docs.map((d): FixedType => ({ id: d.id, name: d.data().name as string, disabled: d.data().disabled === true })).sort((a, b) => a.name.localeCompare(b.name, 'es-AR'))
            emit()
          },
          fail,
        ),
        onSnapshot(
          collection(db, 'fixedExpenses'),
          (snapshot) => {
            entries = snapshot.docs.map((d): FixedEntry => ({ typeId: d.data().typeId as string, month: d.data().month as string, amount: d.data().amount as number }))
            emit()
          },
          fail,
        ),
      )
      return () => unsubscribers.forEach((u) => u())
    },
  }
}

export function createFirestoreFixedApi(db: Firestore): FixedApi {
  return {
    async addType(name) {
      const ref = await addDoc(collection(db, 'fixedTypes'), { name, disabled: false })
      return ref.id
    },
    async renameType(id, name) {
      await updateDoc(doc(db, 'fixedTypes', id), { name })
    },
    async setTypeDisabled(id, disabled) {
      await updateDoc(doc(db, 'fixedTypes', id), { disabled })
    },
    async save(typeId, month, amount) {
      await setDoc(doc(db, 'fixedExpenses', entryKey(typeId, month)), { typeId, month, amount })
    },
    async clear(typeId, month) {
      await deleteDoc(doc(db, 'fixedExpenses', entryKey(typeId, month)))
    },
  }
}
