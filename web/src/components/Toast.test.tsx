import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScreenError } from './ScreenError'
import { ToastProvider, useToast } from './Toast'

function Trigger() {
  const toast = useToast()
  return <button onClick={() => toast('Guardado')}>guardar</button>
}

afterEach(() => vi.useRealTimers())

describe('Toast', () => {
  it('announces the confirmation and removes it by itself', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await userEvent.click(screen.getByRole('button', { name: 'guardar' }))
    expect(screen.getByRole('status')).toHaveTextContent('Guardado')
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByRole('status')).not.toHaveTextContent('Guardado')
  })

  it('does nothing (and does not crash) outside a provider', async () => {
    render(<Trigger />)
    await userEvent.click(screen.getByRole('button', { name: 'guardar' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('ScreenError', () => {
  it('shows the message with a button to try again', () => {
    render(<ScreenError>No se pudo cargar.</ScreenError>)
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
