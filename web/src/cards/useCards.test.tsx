import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { strings } from '@/strings'
import type { CardsData, CardsSource } from './cardsApi'
import { useCards } from './useCards'

function fakeSource() {
  let onData: (data: CardsData) => void = () => {}
  let onError: (error: Error) => void = () => {}
  const unsubscribe = vi.fn()
  const source: CardsSource = {
    subscribe: vi.fn((data, error) => {
      onData = data
      onError = error
      return unsubscribe
    }),
  }
  return { source, unsubscribe, emit: (d: CardsData) => act(() => onData(d)), fail: (e: Error) => act(() => onError(e)) }
}

const data: CardsData = {
  accounts: [{ id: 'a1', name: 'Cuenta ejemplo', owner: 'JUAN' }],
  cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
  cycles: [],
}

describe('useCards', () => {
  it('is loading and then ready with the data', () => {
    const fake = fakeSource()
    const { result } = renderHook(() => useCards(fake.source))
    expect(result.current.status).toBe('loading')

    fake.emit(data)

    expect(result.current).toMatchObject({ status: 'ready', data, error: null })
  })

  it('exposes an error when the source fails and drops the data', () => {
    const fake = fakeSource()
    const { result } = renderHook(() => useCards(fake.source))
    fake.emit(data)

    fake.fail(new Error('permission-denied'))

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe(strings.cards.error)
    expect(result.current.data).toEqual({ accounts: [], cards: [], cycles: [] })
  })

  it('unsubscribes on unmount', () => {
    const fake = fakeSource()
    const { unmount } = renderHook(() => useCards(fake.source))
    unmount()
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
