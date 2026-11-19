import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Category } from '@/categories/types'
import type { UncategorizedItem } from '@/data/types'
import { strings } from '@/strings'
import { ToCategorize } from './ToCategorize'

let n = 0
const item = (over: Partial<UncategorizedItem> = {}): UncategorizedItem => ({
  id: `p${++n}`,
  month: '2026-10',
  merchant: `COMERCIO ${n}`,
  amount: 100,
  currency: 'ARS',
  purchaseDate: new Date('2026-10-20T03:00:00Z'),
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  ...over,
})
const categories: Category[] = [{ id: 'food', name: 'Comida', color: '#111111', archived: false }]

describe('ToCategorize', () => {
  it('says so when the list is empty', () => {
    render(<ToCategorize items={[]} categories={categories} onCategorize={vi.fn()} />)
    expect(screen.getByText(strings.toCategorize.empty)).toBeInTheDocument()
  })

  it('lists every uncategorized item, however old', () => {
    render(
      <ToCategorize
        items={[
          item({ merchant: 'MUY VIEJA', month: '2024-01', purchaseDate: new Date('2024-01-10T03:00:00Z') }),
          item({ merchant: 'NUEVA', month: '2026-11', purchaseDate: new Date('2026-11-02T03:00:00Z') }),
          item({ merchant: 'DEL MES PASADO', month: '2026-10', purchaseDate: new Date('2026-10-05T03:00:00Z') }),
        ]}
        categories={categories}
        onCategorize={vi.fn()}
      />,
    )
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '')
    const order = ['NUEVA', 'DEL MES PASADO', 'MUY VIEJA'].map((m) => rows.findIndex((t) => t.includes(m)))
    expect(order.every((i) => i > -1)).toBe(true)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('categorizing passes the purchase as an expense with its id, month and merchant', async () => {
    const onCategorize = vi.fn()
    render(<ToCategorize items={[item({ id: 'x1', merchant: 'SUPER' })]} categories={categories} onCategorize={onCategorize} />)
    await userEvent.click(screen.getByRole('combobox', { name: strings.categories.changeAria('SUPER') }))
    await userEvent.click(await screen.findByRole('option', { name: 'Comida' }))
    expect(onCategorize).toHaveBeenCalledWith(expect.objectContaining({ id: 'x1', merchant: 'SUPER', month: '2026-10' }), 'food')
  })
})
