import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { DataProvider, useMonths } from './DataProvider'
import { DataStore } from './dataStore'
import { createFakeBackend } from './fakeBackend'
import type { MonthData } from './types'

const month = (id: string, over: Partial<MonthData> = {}): MonthData => ({
  id,
  expenses: [],
  incomes: [],
  savings: [],
  fixed: {},
  rate: null,
  rateInherited: false,
  cap: null,
  capInherited: false,
  ...over,
})

const setup = () => {
  const backend = createFakeBackend({ months: [month('2026-09', { rate: 900 }), month('2026-10')] })
  const store = new DataStore(backend)
  const wrapper = ({ children }: { children: ReactNode }) => <DataProvider store={store}>{children}</DataProvider>
  return { backend, store, wrapper }
}

describe('useMonths', () => {
  it('returns the existing months once all are read, each read once', async () => {
    const { backend, wrapper } = setup()
    const { result, rerender } = renderHook(({ ids }) => useMonths(ids), { wrapper, initialProps: { ids: ['2026-10', '2030-01'] } })
    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data?.map((m) => m.id)).toEqual(['2026-10'])
    rerender({ ids: ['2026-10', '2030-01'] })
    expect(backend.reads).toEqual(['month:2026-10', 'month:2030-01'])
  })

  it("'all' follows config.months, including a month created by a write", async () => {
    const { store, wrapper } = setup()
    const { result } = renderHook(() => useMonths('all'), { wrapper })
    await waitFor(() => expect(result.current.data?.map((m) => m.id)).toEqual(['2026-09', '2026-10']))
    await act(() => store.ratesApi.save('2026-11', 1000))
    await waitFor(() => expect(result.current.data?.map((m) => m.id)).toEqual(['2026-09', '2026-10', '2026-11']))
  })

  it("'all' keeps the previous data while a month added by a write is read", async () => {
    const { store, wrapper } = setup()
    const statuses: string[] = []
    const { result } = renderHook(
      () => {
        const load = useMonths('all')
        statuses.push(load.status)
        return load
      },
      { wrapper },
    )
    await waitFor(() => expect(result.current.status).toBe('ready'))
    const readyAt = statuses.length
    await act(() => store.ratesApi.save('2026-11', 1000))
    await waitFor(() => expect(result.current.data?.map((m) => m.id)).toEqual(['2026-09', '2026-10', '2026-11']))
    expect(statuses.slice(readyAt - 1).every((s) => s === 'ready')).toBe(true)
  })

  it('stays loading while the ids are not known', () => {
    const { backend, wrapper } = setup()
    const { result } = renderHook(() => useMonths(null), { wrapper })
    expect(result.current.status).toBe('loading')
    expect(backend.reads).toEqual([])
  })
})
