import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthProvider'
import type { AuthApi, AuthUser } from './authApi'

const person: AuthUser = { uid: 'u1', displayName: 'Persona Uno', photoURL: null, email: 'user@example.com' }

function fakeApi({ claim = false }: { claim?: boolean } = {}) {
  let listener: ((user: AuthUser | null) => void) | undefined
  const state = { claim }
  const api: AuthApi = {
    onAuthChange: vi.fn((cb) => {
      listener = cb
      return () => {
        listener = undefined
      }
    }),
    hasHouseholdClaim: vi.fn(async () => state.claim),
    signInWithGoogle: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      listener?.(null)
    }),
  }
  return { api, state, emit: (user: AuthUser | null) => act(async () => listener?.(user)) }
}

function Probe() {
  const { state, error, signIn, signOut, recheck } = useAuth()
  return (
    <div>
      <p data-testid="status">{state.status}</p>
      <p data-testid="error">{error ?? ''}</p>
      <button onClick={() => void signIn()}>sign in</button>
      <button onClick={() => void signOut()}>sign out</button>
      <button onClick={() => void recheck()}>recheck</button>
    </div>
  )
}

const setup = (options?: { claim?: boolean }) => {
  const fake = fakeApi(options)
  render(
    <AuthProvider api={fake.api}>
      <Probe />
    </AuthProvider>,
  )
  return fake
}
const status = () => screen.getByTestId('status').textContent

describe('AuthProvider', () => {
  it('starts in loading until the first auth callback', () => {
    setup()
    expect(status()).toBe('loading')
  })

  it('is signed out when there is no user', async () => {
    const fake = setup()
    await fake.emit(null)
    expect(status()).toBe('signedOut')
  })

  it('is unauthorized when the user has no household claim', async () => {
    const fake = setup({ claim: false })
    await fake.emit(person)
    expect(status()).toBe('unauthorized')
  })

  it('is authorized when the user has the claim', async () => {
    const fake = setup({ claim: true })
    await fake.emit(person)
    expect(status()).toBe('authorized')
  })

  it('recheck forces a token refresh and becomes authorized when the claim appears', async () => {
    const fake = setup({ claim: false })
    await fake.emit(person)
    expect(status()).toBe('unauthorized')

    fake.state.claim = true
    await userEvent.click(screen.getByText('recheck'))

    await waitFor(() => expect(status()).toBe('authorized'))
    expect(fake.api.hasHouseholdClaim).toHaveBeenLastCalledWith(true)
  })

  it('a sign-in failure (popup closed) keeps the state signed out and exposes an error', async () => {
    const fake = setup()
    await fake.emit(null)
    vi.mocked(fake.api.signInWithGoogle).mockRejectedValueOnce(new Error('auth/popup-closed-by-user'))

    await userEvent.click(screen.getByText('sign in'))

    await waitFor(() => expect(screen.getByTestId('error').textContent).not.toBe(''))
    expect(status()).toBe('signedOut')
  })

  it('fails closed when the claim check fails: unauthorized with an error, never stuck on loading', async () => {
    const fake = setup({ claim: true })
    vi.mocked(fake.api.hasHouseholdClaim).mockRejectedValueOnce(new Error('auth/network-request-failed'))

    await fake.emit(person)

    expect(status()).toBe('unauthorized')
    expect(screen.getByTestId('error').textContent).not.toBe('')
  })

  it('a recheck that fails keeps the state and shows an error; a later recheck can still succeed', async () => {
    const fake = setup({ claim: false })
    await fake.emit(person)
    vi.mocked(fake.api.hasHouseholdClaim).mockRejectedValueOnce(new Error('auth/network-request-failed'))

    await userEvent.click(screen.getByText('recheck'))
    await waitFor(() => expect(screen.getByTestId('error').textContent).not.toBe(''))
    expect(status()).toBe('unauthorized')

    fake.state.claim = true
    await userEvent.click(screen.getByText('recheck'))
    await waitFor(() => expect(status()).toBe('authorized'))
    expect(screen.getByTestId('error').textContent).toBe('')
  })

  it('signing out returns to signed out', async () => {
    const fake = setup({ claim: true })
    await fake.emit(person)
    expect(status()).toBe('authorized')

    await userEvent.click(screen.getByText('sign out'))

    await waitFor(() => expect(status()).toBe('signedOut'))
  })
})
