import { useEffect, useState } from 'react'
import { strings } from '@/strings'
import type { CategoriesSource } from './categoriesApi'
import type { Category } from './types'

type CategoriesState = { status: 'loading' | 'ready' | 'error'; categories: Category[]; error: string | null }

// Subscribes to the source while the component is mounted.
export function useCategories(source: CategoriesSource): CategoriesState {
  const [state, setState] = useState<CategoriesState>({ status: 'loading', categories: [], error: null })
  useEffect(() => {
    return source.subscribe(
      (categories) => setState({ status: 'ready', categories, error: null }),
      () => setState({ status: 'error', categories: [], error: strings.categories.error }),
    )
  }, [source])
  return state
}
