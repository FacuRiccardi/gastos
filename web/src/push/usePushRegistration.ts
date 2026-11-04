import { useEffect, useRef } from 'react'
import type { PushApi } from './pushApi'

// Registers this phone for push: asks for permission when it was never asked, then stores the FCM
// token for the signed-in person. Runs once per mount; failures are only logged.
export function usePushRegistration(api: PushApi, uid: string): void {
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const register = async () => {
      if (api.support() === 'unsupported') return
      let permission = api.permission()
      if (permission === 'default') permission = await api.requestPermission()
      if (permission !== 'granted') return
      const token = await api.getToken()
      if (token) await api.saveToken(uid, token)
    }
    register().catch((error) => console.warn('push registration failed', error))
  }, [api, uid])
}
