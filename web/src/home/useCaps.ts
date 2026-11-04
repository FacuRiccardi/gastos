import { useEffect, useState } from 'react'
import { strings } from '@/strings'
import type { Caps, CapsSource } from './capsApi'

type CapsState = { status: 'loading' | 'ready' | 'error'; caps: Caps; error: string | null }

// Subscribes to the source while the component is mounted.
export function useCaps(source: CapsSource): CapsState {
  const [state, setState] = useState<CapsState>({ status: 'loading', caps: {}, error: null })
  useEffect(() => {
    return source.subscribe(
      (caps) => setState({ status: 'ready', caps, error: null }),
      () => setState({ status: 'error', caps: {}, error: strings.home.error }),
    )
  }, [source])
  return state
}
