import { CardsSkeleton } from '@/components/LoadingSkeletons'
import { ScreenError } from '@/components/ScreenError'
import { useConfig, useDataStore } from '@/data/DataProvider'
import { CardsScreen } from './CardsScreen'

export function CardsTab() {
  const store = useDataStore()
  const config = useConfig()
  if (config.status === 'error') return <ScreenError>{config.error}</ScreenError>
  if (!config.data) return <CardsSkeleton />
  return <CardsScreen data={config.data.cards} seenCards={config.data.seenCards} api={store.cardsApi} />
}
