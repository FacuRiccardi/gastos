import { useEffect, useState } from 'react'
import { strings } from '@/strings'
import type { MerchantEntry, MerchantsSource } from './merchantsApi'

type MerchantsState = { status: 'loading' | 'ready' | 'error'; merchants: MerchantEntry[]; error: string | null }

// Subscribes to the dictionary while the component is mounted.
export function useMerchants(source: MerchantsSource): MerchantsState {
  const [state, setState] = useState<MerchantsState>({ status: 'loading', merchants: [], error: null })
  useEffect(() => {
    return source.subscribe(
      (merchants) => setState({ status: 'ready', merchants, error: null }),
      () => setState({ status: 'error', merchants: [], error: strings.categories.dictionary.error }),
    )
  }, [source])
  return state
}
