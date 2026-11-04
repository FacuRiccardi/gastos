import { useEffect, useState } from 'react'
import { strings } from '@/strings'
import type { EntriesSource, Entry } from './entries'

type EntriesState = { status: 'loading' | 'ready' | 'error'; entries: Entry[]; error: string | null }

// Subscribes to the source while the component is mounted.
export function useEntries(source: EntriesSource): EntriesState {
  const [state, setState] = useState<EntriesState>({ status: 'loading', entries: [], error: null })
  useEffect(() => {
    return source.subscribe(
      (entries) => setState({ status: 'ready', entries, error: null }),
      () => setState({ status: 'error', entries: [], error: strings.money.error }),
    )
  }, [source])
  return state
}
