import { ClosedCardsSkeleton } from '@/components/LoadingSkeletons'
import { ScreenError } from '@/components/ScreenError'
import { useConfig, useDataStore, useUncategorized } from '@/data/DataProvider'
import type { Expense } from '@/lib/expense'
import { CategoriesScreen, type CategoriesSection } from './CategoriesScreen'

export function CategoriesTab({
  onCategorize,
  initialOpen,
}: {
  onCategorize: (expense: Expense, categoryId: string | null) => void
  initialOpen?: CategoriesSection | null
}) {
  const store = useDataStore()
  const config = useConfig()
  const uncategorized = useUncategorized()
  if (config.status === 'error') return <ScreenError>{config.error}</ScreenError>
  if (uncategorized.status === 'error') return <ScreenError>{uncategorized.error}</ScreenError>
  if (!config.data || !uncategorized.data) return <ClosedCardsSkeleton count={3} />
  return (
    <CategoriesScreen
      uncategorized={uncategorized.data}
      categories={config.data.categories}
      api={store.categoriesApi}
      merchants={config.data.merchants}
      merchantsApi={store.merchantsApi}
      onCategorize={onCategorize}
      initialOpen={initialOpen}
    />
  )
}
