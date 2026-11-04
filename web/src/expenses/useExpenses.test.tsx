import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { strings } from '@/strings'
import type { Expense } from '@/lib/expense'
import type { ExpensesSource } from './expensesSource'
import { useExpenses } from './useExpenses'

function fakeSource() {
  let onData: (expenses: Expense[]) => void = () => {}
  let onError: (error: Error) => void = () => {}
  const unsubscribe = vi.fn()
  const source: ExpensesSource = {
    subscribe: vi.fn((data, error) => {
      onData = data
      onError = error
      return unsubscribe
    }),
  }
  return { source, unsubscribe, emit: (e: Expense[]) => act(() => onData(e)), fail: (e: Error) => act(() => onError(e)) }
}

const expense: Expense = {
  id: 'm1',
  purchaseDate: new Date('2026-03-15T03:00:00Z'),
  receivedAt: new Date('2026-03-15T18:30:00Z'),
  merchant: 'RECARGAS EJEMPLO',
  amount: 12500,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
}

describe('useExpenses', () => {
  it('is loading and then ready with the data', () => {
    const fake = fakeSource()
    const { result } = renderHook(() => useExpenses(fake.source))
    expect(result.current.status).toBe('loading')

    fake.emit([expense])

    expect(result.current).toMatchObject({ status: 'ready', expenses: [expense], error: null })
  })

  it('exposes an error when the source fails (for example permission-denied)', () => {
    const fake = fakeSource()
    const { result } = renderHook(() => useExpenses(fake.source))

    fake.fail(new Error('permission-denied'))

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe(strings.expenses.error)
    expect(result.current.expenses).toEqual([])
  })

  it('shows an error even after having shown data (the claim is revoked while the app is open)', () => {
    const fake = fakeSource()
    const { result } = renderHook(() => useExpenses(fake.source))
    fake.emit([expense])

    fake.fail(new Error('permission-denied'))

    expect(result.current.status).toBe('error')
    expect(result.current.expenses).toEqual([])
  })

  it('unsubscribes on unmount', () => {
    const fake = fakeSource()
    const { unmount } = renderHook(() => useExpenses(fake.source))
    unmount()
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
