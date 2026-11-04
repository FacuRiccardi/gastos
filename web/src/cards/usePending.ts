import { useRef, useState } from 'react'

export type Run = (action: () => Promise<unknown>) => Promise<boolean>

// Tracks a pending call so a submit button can be disabled and a second click is ignored.
export function usePending(run: Run) {
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const guarded: Run = async (action) => {
    if (busy.current) return false
    busy.current = true
    setPending(true)
    try {
      return await run(action)
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return [pending, guarded] as const
}
