import type { Expense } from '@/lib/expense'
import { parseDisplayDate } from '@/lib/dates'
import { cardKey } from './types'
import type { Account, Card, DetectedCard, NewCycle } from './types'

/**
 * Cards that still need an account: cards seen in the expenses that have no stored card, plus
 * stored cards whose account no longer exists. Sorted by holder, then last 4.
 */
export function findUnassignedCards(
  expenses: Expense[],
  cards: Card[],
  accounts: Account[],
): DetectedCard[] {
  const storedKeys = new Set(cards.map(cardKey))
  const accountIds = new Set(accounts.map((a) => a.id))
  const latest = new Map<string, Expense>()

  for (const e of expenses) {
    const key = cardKey({ last4: e.cardLast4, type: e.cardType })
    if (storedKeys.has(key)) continue
    const current = latest.get(key)
    if (!current || e.purchaseDate.getTime() > current.purchaseDate.getTime()) latest.set(key, e)
  }

  const result: DetectedCard[] = [...latest.values()].map((e) => ({
    last4: e.cardLast4,
    type: e.cardType,
    holder: e.cardHolder,
  }))
  for (const c of cards) {
    if (!accountIds.has(c.accountId)) result.push({ last4: c.last4, type: c.type, holder: c.holder })
  }

  return result.sort((a, b) => a.holder.localeCompare(b.holder) || a.last4.localeCompare(b.last4))
}

export type CycleLineError = {
  line: number
  code: 'format' | 'date' | 'dueBeforeClosing' | 'duplicateInText' | 'duplicateStored'
}

const DATE_SHAPE = /^\d{1,2}\/\d{1,2}\/\d{4}$/

/** Parses one cycle per line: `dd/mm/yyyy dd/mm/yyyy` or just `dd/mm/yyyy` (no due date). */
export function parseCyclesText(
  text: string,
  existingClosingDates: string[],
): { cycles: NewCycle[]; errors: CycleLineError[] } {
  const cycles: NewCycle[] = []
  const errors: CycleLineError[] = []
  const stored = new Set(existingClosingDates)
  const seen = new Set<string>()

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = index + 1
    const trimmed = raw.trim()
    if (trimmed === '') return

    const parts = trimmed.split(/\s+/)
    if (parts.length > 2 || !parts.every((p) => DATE_SHAPE.test(p))) {
      errors.push({ line, code: 'format' })
      return
    }
    const closingDate = parseDisplayDate(parts[0])
    const dueDate = parts.length === 2 ? parseDisplayDate(parts[1]) : null
    if (closingDate === null || (parts.length === 2 && dueDate === null)) {
      errors.push({ line, code: 'date' })
      return
    }
    if (dueDate !== null && dueDate < closingDate) {
      errors.push({ line, code: 'dueBeforeClosing' })
      return
    }
    if (seen.has(closingDate)) {
      errors.push({ line, code: 'duplicateInText' })
      return
    }
    if (stored.has(closingDate)) {
      errors.push({ line, code: 'duplicateStored' })
      return
    }
    seen.add(closingDate)
    cycles.push({ closingDate, dueDate })
  })

  return { cycles, errors }
}

/** Trimmed, inner spaces collapsed, upper case (es-AR). */
export function normalizeOwner(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-AR')
}
