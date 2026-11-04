import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CollapsibleCard } from './CollapsibleCard'

describe('CollapsibleCard', () => {
  it('is closed by default: the title shows and the content does not', () => {
    render(<CollapsibleCard title="Mis datos">Contenido secreto</CollapsibleCard>)
    expect(screen.getByRole('button', { name: 'Mis datos' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Contenido secreto')).not.toBeInTheDocument()
  })

  it('opens when the title is clicked and closes when it is clicked again', async () => {
    const user = userEvent.setup()
    render(<CollapsibleCard title="Mis datos">Contenido secreto</CollapsibleCard>)
    const toggle = screen.getByRole('button', { name: 'Mis datos' })
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Contenido secreto')).toBeInTheDocument()
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Contenido secreto')).not.toBeInTheDocument()
  })

  it('starts open with defaultOpen and can then be closed', async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleCard title="Mis datos" defaultOpen>
        Contenido secreto
      </CollapsibleCard>,
    )
    expect(screen.getByText('Contenido secreto')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mis datos' }))
    expect(screen.queryByText('Contenido secreto')).not.toBeInTheDocument()
  })

  it('is a named region and links the toggle to its content', async () => {
    const user = userEvent.setup()
    render(<CollapsibleCard title="Mis datos">Contenido secreto</CollapsibleCard>)
    expect(screen.getByRole('region', { name: 'Mis datos' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mis datos' }))
    const toggle = screen.getByRole('button', { name: 'Mis datos' })
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).toHaveTextContent('Contenido secreto')
  })

  it('shows the info button only when a tooltip is given', () => {
    const { rerender } = render(<CollapsibleCard title="Mis datos">x</CollapsibleCard>)
    expect(screen.queryByRole('button', { name: 'Más información' })).not.toBeInTheDocument()
    rerender(
      <CollapsibleCard title="Mis datos" tooltip="Explicación">
        x
      </CollapsibleCard>,
    )
    expect(screen.getByRole('button', { name: 'Más información' })).toBeInTheDocument()
  })
})
