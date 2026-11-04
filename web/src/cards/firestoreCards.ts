// Firestore implementation of the Cards data layer. No `@/` imports: the root emulator tests import this file.
// Access is enforced by the Firestore rules, not by this code.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import type { CardsApi, CardsData, CardsSource } from './cardsApi'
import { cardKey, cycleKey, type Account, type Card, type Cycle } from './types'

export function createFirestoreCardsSource(db: Firestore): CardsSource {
  return {
    subscribe(onData, onError) {
      const latest: { accounts?: Account[]; cards?: Card[]; cycles?: Cycle[] } = {}
      let errored = false
      let unsubscribers: Array<() => void> = []
      const emit = () => {
        // A fresh object each time, so a React consumer sees a new reference and re-renders.
        if (!errored && latest.accounts && latest.cards && latest.cycles) {
          onData({ accounts: latest.accounts, cards: latest.cards, cycles: latest.cycles })
        }
      }
      // The first error stops all three listeners and is reported once.
      const fail = (error: Error) => {
        if (errored) return
        errored = true
        unsubscribers.forEach((u) => u())
        onError(error)
      }
      const listen = <K extends keyof CardsData>(name: K, map: (id: string, d: Record<string, unknown>) => CardsData[K][number]) =>
        onSnapshot(
          collection(db, name),
          (snapshot) => {
            latest[name] = snapshot.docs.map((d) => map(d.id, d.data())) as never
            emit()
          },
          (error) => fail(error),
        )
      unsubscribers = [
        listen('accounts', (id, d) => ({ id, name: d.name as string, owner: d.owner as string })),
        listen('cards', (_id, d) => ({
          last4: d.last4 as string,
          type: d.type as Card['type'],
          holder: d.holder as string,
          accountId: d.accountId as string,
        })),
        listen('cycles', (_id, d) => ({
          accountId: d.accountId as string,
          closingDate: d.closingDate as string,
          dueDate: (d.dueDate as string | null) ?? null,
        })),
      ]
      return () => unsubscribers.forEach((u) => u())
    },
  }
}

// Note: Firestore batches allow at most 500 writes. addCycles and deleteAccount stay single-batch on purpose
// (atomicity); the expected volume (a few dozen cycles/cards per account) is far below the limit.
export function createFirestoreCardsApi(db: Firestore): CardsApi {
  return {
    async createAccount(input) {
      const ref = await addDoc(collection(db, 'accounts'), { name: input.name, owner: input.owner })
      return ref.id
    },
    async updateAccount(id, input) {
      await updateDoc(doc(db, 'accounts', id), { name: input.name, owner: input.owner })
    },
    async deleteAccount(id) {
      const [cycles, cards] = await Promise.all([
        getDocs(query(collection(db, 'cycles'), where('accountId', '==', id))),
        getDocs(query(collection(db, 'cards'), where('accountId', '==', id))),
      ])
      const batch = writeBatch(db)
      cycles.docs.forEach((d) => batch.delete(d.ref))
      cards.docs.forEach((d) => batch.delete(d.ref))
      batch.delete(doc(db, 'accounts', id))
      await batch.commit()
    },
    async saveCard(card) {
      await setDoc(doc(db, 'cards', cardKey(card)), {
        last4: card.last4,
        type: card.type,
        holder: card.holder,
        accountId: card.accountId,
      })
    },
    async removeCard(card) {
      await deleteDoc(doc(db, 'cards', cardKey(card)))
    },
    async addCycles(accountId, cycles) {
      const batch = writeBatch(db)
      for (const c of cycles) {
        batch.set(doc(db, 'cycles', cycleKey(accountId, c.closingDate)), {
          accountId,
          closingDate: c.closingDate,
          dueDate: c.dueDate,
        })
      }
      await batch.commit()
    },
    async deleteCycle(accountId, closingDate) {
      await deleteDoc(doc(db, 'cycles', cycleKey(accountId, closingDate)))
    },
  }
}
