// Firestore implementation of the monthly exchange rates (collection `exchangeRates`, one document per month).
import { collection, doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import type { RatesApi, RatesSource } from './ratesApi'

export function createFirestoreRatesSource(db: Firestore): RatesSource {
  return {
    subscribe(onData, onError) {
      return onSnapshot(
        collection(db, 'exchangeRates'),
        (snapshot) => onData(Object.fromEntries(snapshot.docs.map((d) => [d.id, d.data().rate as number]))),
        (error) => onError(error),
      )
    },
  }
}

export function createFirestoreRatesApi(db: Firestore): RatesApi {
  return {
    async save(month, rate) {
      await setDoc(doc(db, 'exchangeRates', month), { rate })
    },
  }
}
