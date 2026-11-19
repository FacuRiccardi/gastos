import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import type { DataStore, Load, StoreState } from './dataStore'
import type { AppConfig, MonthData, MonthId, UncategorizedItem } from './types'

const DataContext = createContext<DataStore | null>(null)

export function DataProvider({ store, children }: { store: DataStore; children: ReactNode }) {
  return <DataContext.Provider value={store}>{children}</DataContext.Provider>
}

export function useDataStore(): DataStore {
  const store = useContext(DataContext)
  if (!store) throw new Error('useDataStore must be used inside a DataProvider')
  return store
}

function useStoreState(): StoreState {
  const store = useDataStore()
  return useSyncExternalStore(store.subscribe, store.getState)
}

export function useConfig(): Load<AppConfig> {
  const store = useDataStore()
  useEffect(() => {
    void store.loadConfig()
  }, [store])
  return useStoreState().config
}

export function useUncategorized(): Load<UncategorizedItem[]> {
  const store = useDataStore()
  useEffect(() => {
    void store.loadUncategorized()
  }, [store])
  return useStoreState().uncategorized
}

const LOADING: Load<MonthData[]> = { status: 'loading', data: null, error: null }

/** The existing months among `ids` ('all' = every month of the config; null = not known yet). */
export function useMonths(ids: MonthId[] | 'all' | null): Load<MonthData[]> {
  const store = useDataStore()
  const state = useStoreState()
  const idsKey = ids === null || ids === 'all' ? ids : ids.join(',')
  const wanted = useMemo(
    () => (idsKey === 'all' ? (state.config.data?.months ?? null) : idsKey === null ? null : idsKey.split(',').filter(Boolean)),
    [idsKey, state.config.data],
  )
  // Months that are wanted but neither read nor being read (also after a write drops a cached "does not exist").
  const missing = wanted?.filter((id) => !state.months.has(id)).join(',') ?? ''
  const request = idsKey === 'all' && wanted === null ? 'all' : missing || null

  useEffect(() => {
    if (request !== null) void store.ensureMonths(request === 'all' ? 'all' : request.split(','))
  }, [store, request])

  return useMemo((): Load<MonthData[]> => {
    if (idsKey === 'all' && state.config.status === 'error') return { status: 'error', data: null, error: state.config.error }
    if (wanted === null) return LOADING
    const loads = wanted.map((id) => state.months.get(id))
    if (loads.some((l) => !l || l.status === 'loading')) return LOADING
    const failed = loads.find((l) => l?.status === 'error')
    if (failed) return { status: 'error', data: null, error: failed.error }
    return { status: 'ready', data: loads.flatMap((l) => (l?.data ? [l.data] : [])), error: null }
  }, [idsKey, wanted, state.config, state.months])
}
