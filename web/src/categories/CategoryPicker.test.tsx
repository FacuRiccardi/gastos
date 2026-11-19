import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { strings } from '@/strings'
import { CategoryPicker } from './CategoryPicker'
import type { Category } from './types'

const categories: Category[] = [
  { id: 'food', name: 'Comida', color: '#111111', archived: false },
  { id: 'old', name: 'Vieja', color: '#222222', archived: true },
  { id: 'gone', name: 'Otra vieja', color: '#333333', archived: true },
]

const options = async () => {
  await userEvent.click(screen.getByRole('combobox', { name: strings.categories.changeAria('SUPER') }))
  return (await screen.findAllByRole('option')).map((o) => o.textContent)
}

describe('CategoryPicker', () => {
  it('the picker hides archived categories except the current one', async () => {
    const { unmount } = render(<CategoryPicker categories={categories} categoryId={null} merchant="SUPER" onChange={vi.fn()} />)
    expect(await options()).toEqual([strings.categories.uncategorized, 'Comida'])
    unmount()

    render(<CategoryPicker categories={categories} categoryId="old" merchant="SUPER" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: strings.categories.changeAria('SUPER') })).toHaveTextContent('Vieja')
    expect(await options()).toEqual([strings.categories.uncategorized, 'Comida', 'Vieja'])
  })
})
