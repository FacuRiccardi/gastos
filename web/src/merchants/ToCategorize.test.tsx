import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Category } from '@/categories/types'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import { needsCategory, ToCategorize } from './ToCategorize'

let n = 0
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: `e${++n}`,
  purchaseDate: new Date('2026-10-20T15:00:00Z'),
  receivedAt: new Date('2026-10-20T15:30:00Z'),
  merchant: `COMERCIO ${n}`,
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  ...over,
})
const categories: Category[] = [{ id: 'food', name: 'Comida', color: '#111111' }]

describe('needsCategory', () => {
  it('is true for a purchase with no category', () => {
    expect(needsCategory(expense(), categories)).toBe(true)
    expect(needsCategory(expense({ categoryId: null }), categories)).toBe(true)
    expect(needsCategory(expense({ categoryId: '' }), categories)).toBe(true)
  })

  it('is true when the category no longer exists', () => {
    expect(needsCategory(expense({ categoryId: 'deleted' }), categories)).toBe(true)
    expect(needsCategory(expense({ categoryId: 'food' }), [])).toBe(true)
  })

  it('is false when the category exists', () => {
    expect(needsCategory(expense({ categoryId: 'food' }), categories)).toBe(false)
  })

  it('is false for a rejected purchase, with or without category', () => {
    expect(needsCategory(expense({ status: 'rejected' }), categories)).toBe(false)
    expect(needsCategory(expense({ status: 'rejected', categoryId: 'food' }), categories)).toBe(false)
  })
})

describe('ToCategorize', () => {
  it('says there is nothing to categorize when every purchase has a category', () => {
    render(<ToCategorize expenses={[expense({ categoryId: 'food' })]} categories={categories} onCategorize={vi.fn()} />)
    expect(screen.getByText(strings.toCategorize.empty)).toBeInTheDocument()
  })

  it('says so with no purchases at all', () => {
    render(<ToCategorize expenses={[]} categories={categories} onCategorize={vi.fn()} />)
    expect(screen.getByText(strings.toCategorize.empty)).toBeInTheDocument()
  })

  it('lists only the purchases that need a category, newest first', () => {
    render(
      <ToCategorize
        expenses={[
          expense({ merchant: 'VIEJA SIN', purchaseDate: new Date('2026-10-01T15:00:00Z') }),
          expense({ merchant: 'CON CATEGORIA', categoryId: 'food' }),
          expense({ merchant: 'NUEVA SIN', purchaseDate: new Date('2026-10-25T15:00:00Z') }),
          expense({ merchant: 'RECHAZADA', status: 'rejected' }),
        ]}
        categories={categories}
        onCategorize={vi.fn()}
      />,
    )
    expect(screen.queryByText('CON CATEGORIA')).not.toBeInTheDocument()
    expect(screen.queryByText('RECHAZADA')).not.toBeInTheDocument()
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '')
    const iNew = rows.findIndex((t) => t.includes('NUEVA SIN'))
    const iOld = rows.findIndex((t) => t.includes('VIEJA SIN'))
    expect(iNew).toBeGreaterThan(-1)
    expect(iNew).toBeLessThan(iOld)
  })
})
