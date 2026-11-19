import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { createFirebaseAuthApi } from '@/auth/authApi'
import { createFirestoreBackend } from '@/data/firestoreBackend'
import { auth, db } from '@/lib/firebase'
import { syncSystemTheme } from '@/lib/theme'

syncSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      authApi={createFirebaseAuthApi(auth)}
      createBackend={() => createFirestoreBackend(db)}
    />
  </StrictMode>,
)
