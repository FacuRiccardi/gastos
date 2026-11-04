// Firebase Cloud Messaging implementation of PushApi. Imports no `@/` modules, like the other
// firestore files; the app and the Firestore instance are passed in.
import type { FirebaseApp } from 'firebase/app'
import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { getMessaging, getToken } from 'firebase/messaging'
import type { PushApi } from './pushApi'

export function createFirebasePushApi(app: FirebaseApp, db: Firestore): PushApi {
  return {
    support() {
      const ok = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window
      return ok ? 'supported' : 'unsupported'
    },
    permission() {
      return Notification.permission
    },
    requestPermission() {
      return Notification.requestPermission()
    },
    async getToken() {
      const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      const token = await getToken(getMessaging(app), {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration,
      })
      return token || null
    },
    async saveToken(uid, token) {
      const ref = doc(db, 'pushTokens', token)
      try {
        const existing = await getDoc(ref)
        const createdAt = existing.exists() ? existing.data().createdAt : serverTimestamp()
        await setDoc(ref, { uid, createdAt, updatedAt: serverTimestamp() })
      } catch (error) {
        // A token owned by another person (shared browser) is rejected by the rules: leave it.
        if ((error as { code?: string }).code === 'permission-denied') return
        throw error
      }
    },
  }
}
