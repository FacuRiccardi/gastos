import { useEffect, useState } from 'react'
import { strings } from '@/strings'
import type { CardsData, CardsSource } from './cardsApi'

type CardsState = { status: 'loading' | 'ready' | 'error'; data: CardsData; error: string | null }

const emptyData: CardsData = { accounts: [], cards: [], cycles: [] }

// Subscribes to the source while the component is mounted. If the source fails later (for example
// because the access was revoked), the data is dropped and an error is shown.
export function useCards(source: CardsSource): CardsState {
  const [state, setState] = useState<CardsState>({ status: 'loading', data: emptyData, error: null })

  useEffect(() => {
    return source.subscribe(
      (data) => setState({ status: 'ready', data, error: null }),
      () => setState({ status: 'error', data: emptyData, error: strings.cards.error }),
    )
  }, [source])

  return state
}
