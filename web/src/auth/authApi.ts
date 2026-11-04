import {
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth'

export type AuthUser = {
  uid: string
  displayName: string | null
  photoURL: string | null
  email: string | null
}

// The small surface of Firebase Authentication that the app needs. Components receive it through
// props/context so they can be tested with a fake.
export interface AuthApi {
  onAuthChange(cb: (user: AuthUser | null) => void): () => void
  // True when the signed-in user's ID token carries the `household` claim. `forceRefresh` asks
  // Firebase for a fresh token, which is how a freshly granted claim becomes visible.
  hasHouseholdClaim(forceRefresh?: boolean): Promise<boolean>
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
}

// The claim is read only to choose which screen to show; the Firestore rules do the real enforcement.
export function createFirebaseAuthApi(auth: Auth): AuthApi {
  return {
    onAuthChange(cb) {
      return onAuthStateChanged(auth, (user) =>
        cb(user && { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, email: user.email }),
      )
    },
    async hasHouseholdClaim(forceRefresh = false) {
      const user = auth.currentUser
      if (!user) return false
      const result = await getIdTokenResult(user, forceRefresh)
      return result.claims.household === true
    },
    async signInWithGoogle() {
      await signInWithPopup(auth, new GoogleAuthProvider())
    },
    async signOut() {
      await firebaseSignOut(auth)
    },
  }
}
