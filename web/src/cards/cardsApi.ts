// Interfaces of the Cards data layer. No `@/` imports: the root emulator tests import this file.
import type { Account, Card, Cycle, NewCycle } from './types'

export type CardsData = { accounts: Account[]; cards: Card[]; cycles: Cycle[] }

// Where the cards data comes from. Components receive it through props so tests can use a fake.
export interface CardsSource {
  subscribe(onData: (data: CardsData) => void, onError: (error: Error) => void): () => void
}

// The write operations of the Cards section.
export interface CardsApi {
  createAccount(input: { name: string; owner: string }): Promise<string>
  updateAccount(id: string, input: { name: string; owner: string }): Promise<void>
  deleteAccount(id: string): Promise<void>
  saveCard(card: Card): Promise<void>
  removeCard(card: { last4: string; type: 'credit' | 'debit' }): Promise<void>
  addCycles(accountId: string, cycles: NewCycle[]): Promise<void>
  deleteCycle(accountId: string, closingDate: string): Promise<void>
}
