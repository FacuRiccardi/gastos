// Shared types for the Cards section. No `@/` imports: the root emulator tests import this file.

export type Account = { id: string; name: string; owner: string }

export type Card = {
  last4: string
  type: 'credit' | 'debit'
  holder: string
  accountId: string
}

export type Cycle = { accountId: string; closingDate: string; dueDate: string | null }

export type NewCycle = { closingDate: string; dueDate: string | null }

export type DetectedCard = { last4: string; type: 'credit' | 'debit'; holder: string }

/** Document ID of a card, e.g. `1234_credit`. */
export function cardKey(c: { last4: string; type: string }): string {
  return `${c.last4}_${c.type}`
}

/** Document ID of a cycle, e.g. `acc1_2026-03-05`. */
export function cycleKey(accountId: string, closingDate: string): string {
  return `${accountId}_${closingDate}`
}
