import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { strings } from '@/strings'
import type { AuthApi, AuthUser } from './authApi'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'unauthorized'; user: AuthUser }
  | { status: 'authorized'; user: AuthUser }

type AuthContextValue = {
  state: AuthState
  error: string | null
  signIn(): Promise<void>
  signOut(): Promise<void>
  recheck(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ api, children }: { api: AuthApi; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [error, setError] = useState<string | null>(null)
  const userRef = useRef<AuthUser | null>(null)
  // Ignores the result of a check that was overtaken by a newer auth change.
  const generation = useRef(0)

  const resolve = useCallback(
    async (user: AuthUser, forceRefresh: boolean) => {
      const current = ++generation.current
      try {
        const allowed = await api.hasHouseholdClaim(forceRefresh)
        if (current !== generation.current) return
        setError(null)
        setState({ status: allowed ? 'authorized' : 'unauthorized', user })
      } catch {
        if (current !== generation.current) return
        // Fail closed: if the claim cannot be checked (for example no connection) nothing is shown
        // and the person can try again, instead of waiting on "loading" forever.
        setState({ status: 'unauthorized', user })
        setError(strings.noAccess.checkError)
      }
    },
    [api],
  )

  useEffect(() => {
    return api.onAuthChange((user) => {
      userRef.current = user
      if (!user) {
        generation.current++
        setState({ status: 'signedOut' })
        return
      }
      setError(null)
      void resolve(user, false)
    })
  }, [api, resolve])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      await api.signInWithGoogle()
    } catch {
      setError(strings.login.error)
    }
  }, [api])

  const signOut = useCallback(() => api.signOut(), [api])

  const recheck = useCallback(async () => {
    if (userRef.current) await resolve(userRef.current, true)
  }, [resolve])

  const value = useMemo(() => ({ state, error, signIn, signOut, recheck }), [state, error, signIn, signOut, recheck])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside an AuthProvider')
  return value
}
