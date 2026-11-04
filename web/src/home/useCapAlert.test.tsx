import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CapAlert, CapAlertSource } from './capAlertApi'
import { useCapAlert } from './useCapAlert'

type Data = { alert: CapAlert | null; dismissedLevel: number | null }

function fakeSource() {
  let onData: (d: Data) => void = () => {}
  let onError: (e: Error) => void = () => {}
  const unsubscribe = vi.fn()
  const subscribe = vi.fn((_month: string, data: (d: Data) => void, error: (e: Error) => void) => {
    onData = data
    onError = error
    return unsubscribe
  })
  const source: CapAlertSource = { subscribe }
  return { source, subscribe, unsubscribe, emit: (d: Data) => onData(d), fail: (e: Error) => onError(e) }
}

const alert50: CapAlert = { month: '2026-11', lastLevel: 50, total: 500, cap: 1000 }

describe('useCapAlert', () => {
  it('is loading until the source answers, then returns the alert', () => {
    const f = fakeSource()
    const { result } = renderHook(() => useCapAlert(f.source, '2026-11'))
    expect(result.current).toEqual({ status: 'loading', alert: null })
    act(() => f.emit({ alert: alert50, dismissedLevel: null }))
    expect(result.current).toEqual({ status: 'ready', alert: alert50 })
  })

  it('hides a dismissed alert and shows a new one with a higher level', () => {
    const f = fakeSource()
    const { result } = renderHook(() => useCapAlert(f.source, '2026-11'))
    act(() => f.emit({ alert: alert50, dismissedLevel: 50 }))
    expect(result.current).toEqual({ status: 'ready', alert: null })
    const alert75 = { ...alert50, lastLevel: 75 }
    act(() => f.emit({ alert: alert75, dismissedLevel: 50 }))
    expect(result.current.alert).toBe(alert75)
  })

  it('resubscribes when the month changes and unsubscribes the previous one', () => {
    const f = fakeSource()
    const { result, rerender } = renderHook(({ month }) => useCapAlert(f.source, month), { initialProps: { month: '2026-11' as string | null } })
    act(() => f.emit({ alert: alert50, dismissedLevel: null }))
    rerender({ month: '2026-12' })
    expect(f.unsubscribe).toHaveBeenCalledTimes(1)
    expect(f.subscribe).toHaveBeenLastCalledWith('2026-12', expect.any(Function), expect.any(Function))
    expect(result.current).toEqual({ status: 'loading', alert: null })
  })

  it('is ready without alert and does not subscribe when the month is null', () => {
    const f = fakeSource()
    const { result } = renderHook(() => useCapAlert(f.source, null))
    expect(result.current).toEqual({ status: 'ready', alert: null })
    expect(f.subscribe).not.toHaveBeenCalled()
  })

  it('reports an error', () => {
    const f = fakeSource()
    const { result } = renderHook(() => useCapAlert(f.source, '2026-11'))
    act(() => f.fail(new Error('x')))
    expect(result.current).toEqual({ status: 'error', alert: null })
  })
})
