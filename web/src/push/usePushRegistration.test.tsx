import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PushApi } from './pushApi'
import { usePushRegistration } from './usePushRegistration'

function fakeApi(overrides: Partial<PushApi> = {}) {
  const api = {
    support: vi.fn(() => 'supported' as const),
    permission: vi.fn(() => 'default' as const),
    requestPermission: vi.fn(async () => 'granted' as const),
    getToken: vi.fn(async () => 'tok-1' as string | null),
    saveToken: vi.fn(async () => {}),
    ...overrides,
  }
  return api satisfies PushApi
}

afterEach(() => vi.restoreAllMocks())

describe('usePushRegistration', () => {
  it('asks for permission when it is default, then saves the token with the uid', async () => {
    const api = fakeApi()
    renderHook(() => usePushRegistration(api, 'u1'))
    await waitFor(() => expect(api.saveToken).toHaveBeenCalledWith('u1', 'tok-1'))
    expect(api.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('does not ask when already granted, and saves the token', async () => {
    const api = fakeApi({ permission: vi.fn(() => 'granted' as const) })
    renderHook(() => usePushRegistration(api, 'u1'))
    await waitFor(() => expect(api.saveToken).toHaveBeenCalledWith('u1', 'tok-1'))
    expect(api.requestPermission).not.toHaveBeenCalled()
  })

  it('does nothing when the permission is denied', async () => {
    const api = fakeApi({ permission: vi.fn(() => 'denied' as const) })
    renderHook(() => usePushRegistration(api, 'u1'))
    await Promise.resolve()
    expect(api.requestPermission).not.toHaveBeenCalled()
    expect(api.getToken).not.toHaveBeenCalled()
    expect(api.saveToken).not.toHaveBeenCalled()
  })

  it('does nothing when push is unsupported', async () => {
    const api = fakeApi({ support: vi.fn(() => 'unsupported' as const) })
    renderHook(() => usePushRegistration(api, 'u1'))
    await Promise.resolve()
    expect(api.permission).not.toHaveBeenCalled()
    expect(api.requestPermission).not.toHaveBeenCalled()
    expect(api.saveToken).not.toHaveBeenCalled()
  })

  it('does nothing when the user dismisses the prompt (permission stays default)', async () => {
    const api = fakeApi({ requestPermission: vi.fn(async () => 'default' as const) })
    renderHook(() => usePushRegistration(api, 'u1'))
    await waitFor(() => expect(api.requestPermission).toHaveBeenCalled())
    expect(api.getToken).not.toHaveBeenCalled()
  })

  it('does not save when there is no token', async () => {
    const api = fakeApi({ getToken: vi.fn(async () => null) })
    renderHook(() => usePushRegistration(api, 'u1'))
    await waitFor(() => expect(api.getToken).toHaveBeenCalled())
    expect(api.saveToken).not.toHaveBeenCalled()
  })

  it('swallows a rejected requestPermission', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = fakeApi({ requestPermission: vi.fn(async () => { throw new Error('boom') }) })
    expect(() => renderHook(() => usePushRegistration(api, 'u1'))).not.toThrow()
    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(api.saveToken).not.toHaveBeenCalled()
  })
})
