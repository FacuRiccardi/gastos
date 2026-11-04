import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { strings } from '@/strings'
import { LoginScreen } from './LoginScreen'
import { NoAccessScreen } from './NoAccessScreen'

describe('LoginScreen', () => {
  it('the button calls onSignIn', async () => {
    const onSignIn = vi.fn()
    render(<LoginScreen onSignIn={onSignIn} error={null} />)
    await userEvent.click(screen.getByRole('button', { name: strings.login.button }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('shows the error text and stays usable', async () => {
    const onSignIn = vi.fn()
    render(<LoginScreen onSignIn={onSignIn} error={strings.login.error} />)
    expect(screen.getByText(strings.login.error)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: strings.login.button }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })
})

describe('NoAccessScreen', () => {
  it('has "check again" and "sign out" buttons that call the callbacks', async () => {
    const onCheckAgain = vi.fn()
    const onSignOut = vi.fn()
    render(<NoAccessScreen onCheckAgain={onCheckAgain} onSignOut={onSignOut} />)

    await userEvent.click(screen.getByRole('button', { name: strings.noAccess.checkAgain }))
    await userEvent.click(screen.getByRole('button', { name: strings.noAccess.signOut }))

    expect(onCheckAgain).toHaveBeenCalledTimes(1)
    expect(onSignOut).toHaveBeenCalledTimes(1)
    expect(screen.getByText(strings.noAccess.message)).toBeInTheDocument()
  })

  it('shows the error text when the check failed', () => {
    render(<NoAccessScreen onCheckAgain={vi.fn()} onSignOut={vi.fn()} error={strings.noAccess.checkError} />)
    expect(screen.getByRole('alert')).toHaveTextContent(strings.noAccess.checkError)
  })
})
