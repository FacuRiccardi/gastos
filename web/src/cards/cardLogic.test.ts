import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/expense'
import type { Account, Card } from './types'
import type { SeenCard } from '@/data/types'
import { findUnassignedCards, normalizeOwner, parseCyclesText, seenCardsOf } from './cardLogic'

function expense(over: Partial<Expense> & { id: string }): Expense {
  return {
    purchaseDate: new Date('2026-03-10T12:00:00Z'),
    receivedAt: new Date('2026-03-10T12:00:00Z'),
    month: '2026-03',
    merchant: 'Test Shop',
    amount: 100,
    currency: 'ARS',
    cardLast4: '1111',
    cardType: 'credit',
    cardHolder: 'ANA TEST',
    ...over,
  }
}

const accounts: Account[] = [{ id: 'acc1', name: 'Main', owner: 'ANA TEST' }]

const seen = (over: Partial<SeenCard> = {}): SeenCard => ({ last4: '1111', type: 'credit', holder: 'ANA TEST', lastSeen: '2026-03-10', ...over })

describe('findUnassignedCards', () => {
  it('findUnassignedCards uses seen cards', () => {
    const result = findUnassignedCards([seen(), seen({ type: 'debit' }), seen({ last4: '2222' })], [], accounts)
    expect(result).toEqual([
      { last4: '1111', type: 'credit', holder: 'ANA TEST' },
      { last4: '1111', type: 'debit', holder: 'ANA TEST' },
      { last4: '2222', type: 'credit', holder: 'ANA TEST' },
    ])
  })

  it('ignores holder differences when matching a stored card', () => {
    const cards: Card[] = [
      { last4: '1111', type: 'credit', holder: 'OTHER NAME', accountId: 'acc1' },
    ]
    expect(findUnassignedCards([seen()], cards, accounts)).toEqual([])
  })

  it('does not return a card stored under an existing account', () => {
    const cards: Card[] = [{ last4: '1111', type: 'credit', holder: 'ANA TEST', accountId: 'acc1' }]
    expect(findUnassignedCards([], cards, accounts)).toEqual([])
  })

  it('returns a stored card whose account does not exist', () => {
    const cards: Card[] = [{ last4: '3333', type: 'debit', holder: 'LOST HOLDER', accountId: 'gone' }]
    expect(findUnassignedCards([], cards, accounts)).toEqual([
      { last4: '3333', type: 'debit', holder: 'LOST HOLDER' },
    ])
  })

  it('sorts by holder then last 4', () => {
    const result = findUnassignedCards(
      [seen({ holder: 'ZOE', last4: '1111' }), seen({ holder: 'ANA', last4: '9999' }), seen({ holder: 'ANA', last4: '2222' })],
      [],
      accounts,
    )
    expect(result.map((c) => `${c.holder}${c.last4}`)).toEqual(['ANA2222', 'ANA9999', 'ZOE1111'])
  })
})

describe('seenCardsOf', () => {
  it('detects each distinct card once', () => {
    const result = seenCardsOf([
      expense({ id: 'a' }),
      expense({ id: 'b' }),
      expense({ id: 'c', cardType: 'debit' }),
      expense({ id: 'd', cardLast4: '2222' }),
    ])
    expect(result.map((c) => `${c.last4}_${c.type}`).sort()).toEqual(['1111_credit', '1111_debit', '2222_credit'])
  })

  it('uses the holder of the most recent expense', () => {
    const result = seenCardsOf([
      expense({ id: 'old', cardHolder: 'OLD HOLDER', purchaseDate: new Date('2026-01-01T12:00:00Z') }),
      expense({ id: 'new', cardHolder: 'NEW HOLDER', purchaseDate: new Date('2026-04-01T12:00:00Z') }),
    ])
    expect(result).toEqual([{ last4: '1111', type: 'credit', holder: 'NEW HOLDER', lastSeen: '2026-04-01' }])
  })
})

describe('parseCyclesText', () => {
  it('parses closing and due dates', () => {
    expect(parseCyclesText('05/03/2026 15/03/2026', [])).toEqual({
      cycles: [{ closingDate: '2026-03-05', dueDate: '2026-03-15' }],
      errors: [],
    })
  })

  it('accepts a line with only a closing date (dueDate null)', () => {
    expect(parseCyclesText('05/03/2026', []).cycles).toEqual([
      { closingDate: '2026-03-05', dueDate: null },
    ])
  })

  it('ignores blank lines and reports 1-based line numbers', () => {
    const result = parseCyclesText('\n05/03/2026\n\n  \nabc', [])
    expect(result.cycles).toEqual([{ closingDate: '2026-03-05', dueDate: null }])
    expect(result.errors).toEqual([{ line: 5, code: 'format' }])
  })

  it('reports format and impossible-date errors', () => {
    const result = parseCyclesText('31/02/2026\nabc\n01/01/2026 02/01/2026 03/01/2026', [])
    expect(result.cycles).toEqual([])
    expect(result.errors).toEqual([
      { line: 1, code: 'date' },
      { line: 2, code: 'format' },
      { line: 3, code: 'format' },
    ])
  })

  it('reports a due date before the closing date', () => {
    expect(parseCyclesText('15/03/2026 05/03/2026', [])).toEqual({
      cycles: [],
      errors: [{ line: 1, code: 'dueBeforeClosing' }],
    })
  })

  it('reports a repeated closing date within the text', () => {
    const result = parseCyclesText('05/03/2026\n05/03/2026 10/03/2026', [])
    expect(result.cycles).toEqual([{ closingDate: '2026-03-05', dueDate: null }])
    expect(result.errors).toEqual([{ line: 2, code: 'duplicateInText' }])
  })

  it('reports a closing date that is already stored', () => {
    const result = parseCyclesText('05/03/2026', ['2026-03-05'])
    expect(result.cycles).toEqual([])
    expect(result.errors).toEqual([{ line: 1, code: 'duplicateStored' }])
  })

  it('accepts a leap day', () => {
    expect(parseCyclesText('29/02/2028', []).cycles).toEqual([
      { closingDate: '2028-02-29', dueDate: null },
    ])
    expect(parseCyclesText('29/02/2027', []).errors).toEqual([{ line: 1, code: 'date' }])
  })
})

describe('normalizeOwner', () => {
  it('trims, collapses spaces and upper-cases', () => {
    expect(normalizeOwner(' ana  ')).toBe('ANA')
    expect(normalizeOwner('ñandú')).toBe('ÑANDÚ')
    expect(normalizeOwner('ana   maria')).toBe('ANA MARIA')
  })
})
