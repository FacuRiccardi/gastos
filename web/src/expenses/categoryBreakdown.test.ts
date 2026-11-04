import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/expense'
import { buildBreakdown, formatPercent, MINOR_COLOR, UNCATEGORIZED_COLOR } from './categoryBreakdown'

let n = 0
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: `e${++n}`,
  purchaseDate: new Date('2026-10-08T15:00:00Z'),
  receivedAt: new Date('2026-10-08T15:30:00Z'),
  merchant: 'COMERCIO',
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  ...over,
})
const categories = [
  { id: 'food', name: 'Comida', color: '#111111' },
  { id: 'fun', name: 'Ocio', color: '#222222' },
  { id: 'tiny', name: 'Chico', color: '#333333' },
  { id: 'tiny2', name: 'Chico dos', color: '#444444' },
]
const labels = { uncategorized: 'Sin categorizar', minor: 'Otras' }
const run = (list: Expense[]) => buildBreakdown(list, categories, labels)

describe('buildBreakdown', () => {
  it('has no slices for no purchases', () => {
    expect(run([])).toEqual({ slices: [], total: 0, hasForeign: false })
  })

  it('adds per category, sorts from the largest and computes percentages', () => {
    const b = run([expense({ categoryId: 'fun', amount: 100 }), expense({ categoryId: 'food', amount: 200 }), expense({ categoryId: 'food', amount: 100 })])
    expect(b.total).toBe(400)
    expect(b.slices.map((s) => [s.id, s.amount, s.percent])).toEqual([
      ['food', 300, 75],
      ['fun', 100, 25],
    ])
    expect(b.slices[0]).toMatchObject({ name: 'Comida', color: '#111111' })
  })

  it('ignores rejected purchases', () => {
    const b = run([expense({ categoryId: 'food', amount: 100 }), expense({ categoryId: 'fun', amount: 500, status: 'rejected' })])
    expect(b.slices.map((s) => s.id)).toEqual(['food'])
  })

  it('leaves other currencies out and reports them', () => {
    const b = run([expense({ categoryId: 'food', amount: 100 }), expense({ categoryId: 'food', amount: 50, currency: 'USD' })])
    expect(b.total).toBe(100)
    expect(b.hasForeign).toBe(true)
  })

  it('does not flag foreign when only rejected purchases are in other currencies', () => {
    expect(run([expense({ categoryId: 'food' }), expense({ currency: 'USD', status: 'rejected' })]).hasForeign).toBe(false)
  })

  it('nets credits (negative amounts) inside their category', () => {
    const b = run([expense({ categoryId: 'food', amount: 300 }), expense({ categoryId: 'food', amount: -100 }), expense({ categoryId: 'fun', amount: 200 })])
    expect(b.slices.map((s) => [s.id, s.amount])).toEqual([
      ['food', 200],
      ['fun', 200],
    ])
  })

  it('hides a category whose net is zero or negative', () => {
    const b = run([expense({ categoryId: 'food', amount: 100 }), expense({ categoryId: 'fun', amount: 50 }), expense({ categoryId: 'fun', amount: -80 })])
    expect(b.slices.map((s) => s.id)).toEqual(['food'])
    expect(b.total).toBe(100)
  })

  it('sends purchases with no category, or a category that no longer exists, to uncategorized', () => {
    const b = run([expense({ amount: 100 }), expense({ categoryId: 'deleted', amount: 100 }), expense({ categoryId: null, amount: 100 })])
    expect(b.slices).toHaveLength(1)
    expect(b.slices[0]).toMatchObject({ id: 'none', name: 'Sin categorizar', color: UNCATEGORIZED_COLOR, amount: 300, percent: 100 })
  })

  it('merges two or more shares under 1% into one virtual slice, placed last', () => {
    const b = run([
      expense({ categoryId: 'food', amount: 10000 }),
      expense({ categoryId: 'fun', amount: 5000 }),
      expense({ categoryId: 'tiny', amount: 50 }),
      expense({ categoryId: 'tiny2', amount: 60 }),
    ])
    expect(b.slices.map((s) => s.id)).toEqual(['food', 'fun', 'minor'])
    const minor = b.slices[2]
    expect(minor).toMatchObject({ name: 'Otras', color: MINOR_COLOR, amount: 110 })
    expect(minor.percent).toBeCloseTo((110 / 15110) * 100)
  })

  it('keeps a single share under 1% as it is', () => {
    const b = run([expense({ categoryId: 'food', amount: 10000 }), expense({ categoryId: 'tiny', amount: 50 })])
    expect(b.slices.map((s) => s.id)).toEqual(['food', 'tiny'])
  })

  it('a share of exactly 1% is not merged', () => {
    const b = run([expense({ categoryId: 'food', amount: 9800 }), expense({ categoryId: 'tiny', amount: 100 }), expense({ categoryId: 'tiny2', amount: 100 })])
    expect(b.slices.map((s) => s.id)).toEqual(['food', 'tiny', 'tiny2'])
  })

  it('percentages add up to 100', () => {
    const b = run([expense({ categoryId: 'food', amount: 33 }), expense({ categoryId: 'fun', amount: 33 }), expense({ amount: 34 })])
    expect(b.slices.reduce((s, x) => s + x.percent, 0)).toBeCloseTo(100)
  })
})

describe('formatPercent', () => {
  it('uses one decimal and a comma', () => {
    expect(formatPercent(12.34)).toBe('12,3%')
    expect(formatPercent(100)).toBe('100,0%')
    expect(formatPercent(0)).toBe('0,0%')
    expect(formatPercent(0.96)).toBe('1,0%')
  })
})

describe('buildBreakdown merchants', () => {
  it('keeps the merchants of each slice, the heaviest first', () => {
    const b = run([
      expense({ categoryId: 'food', merchant: 'CHICO', amount: 100 }),
      expense({ categoryId: 'food', merchant: 'GRANDE', amount: 600 }),
      expense({ categoryId: 'food', merchant: 'GRANDE', amount: 200 }),
    ])
    expect(b.slices[0].top).toEqual([
      { merchant: 'GRANDE', amount: 800 },
      { merchant: 'CHICO', amount: 100 },
    ])
  })

  it('keeps at most five merchants', () => {
    const list = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((m, i) => expense({ categoryId: 'food', merchant: m, amount: 100 + i }))
    expect(run(list).slices[0].top).toHaveLength(5)
  })
})
