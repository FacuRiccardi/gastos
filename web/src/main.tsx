import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { createFirebaseAuthApi } from '@/auth/authApi'
import { createFirestoreCardsApi, createFirestoreCardsSource } from '@/cards/firestoreCards'
import { createFirestoreCategoriesApi, createFirestoreCategoriesSource } from '@/categories/firestoreCategories'
import { createFirestoreEntriesApi, createFirestoreEntriesSource } from '@/money/firestoreEntries'
import { createFirestoreCapsApi, createFirestoreCapsSource } from '@/home/firestoreCaps'
import { createFirestoreRatesApi, createFirestoreRatesSource } from '@/balance/firestoreRates'
import { createFirestoreFixedApi, createFirestoreFixedSource } from '@/fixed/firestoreFixed'
import { createFirestoreMerchantsApi, createFirestoreMerchantsSource } from '@/merchants/firestoreMerchants'
import { createFirestoreExpensesSource } from '@/expenses/expensesSource'
import { auth, db } from '@/lib/firebase'
import { syncSystemTheme } from '@/lib/theme'

syncSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      authApi={createFirebaseAuthApi(auth)}
      createExpensesSource={() => createFirestoreExpensesSource(db)}
      createCardsSource={() => createFirestoreCardsSource(db)}
      createCardsApi={() => createFirestoreCardsApi(db)}
      createCategoriesSource={() => createFirestoreCategoriesSource(db)}
      createCategoriesApi={() => createFirestoreCategoriesApi(db)}
      createEntriesSource={(kind) => createFirestoreEntriesSource(db, kind)}
      createEntriesApi={(kind) => createFirestoreEntriesApi(db, kind)}
      createMerchantsApi={() => createFirestoreMerchantsApi(db)}
      createMerchantsSource={() => createFirestoreMerchantsSource(db)}
      createFixedSource={() => createFirestoreFixedSource(db)}
      createFixedApi={() => createFirestoreFixedApi(db)}
      createRatesSource={() => createFirestoreRatesSource(db)}
      createRatesApi={() => createFirestoreRatesApi(db)}
      createCapsSource={() => createFirestoreCapsSource(db)}
      createCapsApi={() => createFirestoreCapsApi(db)}
    />
  </StrictMode>,
)
