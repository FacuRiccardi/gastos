import { useEffect, useState } from 'react'
import { strings } from '@/strings'
import type { FixedData, FixedSource } from './fixedApi'

type FixedState = { status: 'loading' | 'ready' | 'error'; data: FixedData; error: string | null }
const empty: FixedData = { types: [], entries: [] }

// Subscribes to the source while the component is mounted.
export function useFixed(source: FixedSource): FixedState {
  const [state, setState] = useState<FixedState>({ status: 'loading', data: empty, error: null })
  useEffect(() => {
    return source.subscribe(
      (data) => setState({ status: 'ready', data, error: null }),
      () => setState({ status: 'error', data: empty, error: strings.fixed.error }),
    )
  }, [source])
  return state
}
