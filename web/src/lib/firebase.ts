import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// The web config comes from web/.env (git-ignored). See web/.env.example.
// With `vite --mode emulator` (npm run dev:web) web/.env.emulator overrides it and the app talks
// to the local Firebase emulators instead of production.
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export { app }

// App Check (reCAPTCHA Enterprise; Classic v3 is deprecated): attaches a reCAPTCHA-backed token to every Firestore/Auth request so Firebase can
// reject scripts and bots before they are billed. Skipped with the emulators or when no site key is
// set. In `vite dev` against production, a debug token is printed in the console: register it under
// Firebase console > App Check > Apps > Manage debug tokens.
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY
if (appCheckSiteKey && import.meta.env.VITE_USE_EMULATOR !== 'true') {
  if (import.meta.env.DEV) {
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
export const db = getFirestore(app)

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
