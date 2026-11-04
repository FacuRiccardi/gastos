import { useEffect, useState } from 'react'
import { strings } from '@/strings'
import type { Rates, RatesSource } from './ratesApi'

type RatesState = { status: 'loading' | 'ready' | 'error'; rates: Rates; error: string | null }

// Subscribes to the source while the component is mounted.
export function useRates(source: RatesSource): RatesState {
  const [state, setState] = useState<RatesState>({ status: 'loading', rates: {}, error: null })
  useEffect(() => {
    return source.subscribe(
      (rates) => setState({ status: 'ready', rates, error: null }),
      () => setState({ status: 'error', rates: {}, error: strings.balance.error }),
    )
  }, [source])
  return state
}
