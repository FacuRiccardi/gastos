import { collection, doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import type { MerchantEntry, MerchantsApi, MerchantsSource } from './merchantsApi'
import { merchantKey } from './merchantKey'

export function createFirestoreMerchantsSource(db: Firestore): MerchantsSource {
  return {
    subscribe(onData, onError) {
      return onSnapshot(
        collection(db, 'merchantCategories'),
        (snapshot) =>
          onData(
            snapshot.docs
              .map((d): MerchantEntry => ({ key: d.id, merchant: d.data().merchant as string, categoryId: d.data().categoryId as string }))
              .sort((a, b) => a.merchant.localeCompare(b.merchant, 'es-AR')),
          ),
        (error) => onError(error),
      )
    },
  }
}

export function createFirestoreMerchantsApi(db: Firestore): MerchantsApi {
  return {
    async remember(merchant, categoryId) {
      const key = merchantKey(merchant)
      if (!key) return // nothing stable to remember (the name is only codes)
      await setDoc(doc(db, 'merchantCategories', key), { merchant, categoryId })
    },
  }
}
