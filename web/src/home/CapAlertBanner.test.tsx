import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { strings } from '@/strings'
import { CapAlertBanner } from './CapAlertBanner'

describe('CapAlertBanner', () => {
  const alert = { month: '2026-11', lastLevel: 50, total: 1000000, cap: 2000000 }

  it('says the threshold passed and the amount spent', () => {
    render(<CapAlertBanner alert={alert} onDismiss={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent(/Superaste el 50% de tu tope: vas gastando\s+\$\s*1\.000\.000,00/)
  })

  it('calls onDismiss when "Entendido" is pressed', async () => {
    const onDismiss = vi.fn()
    render(<CapAlertBanner alert={alert} onDismiss={onDismiss} />)
    await userEvent.click(screen.getByRole('button', { name: strings.home.capAlert.dismiss }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
