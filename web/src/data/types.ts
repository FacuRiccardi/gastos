import type { CardsData } from '../cards/cardsApi'
import type { Category } from '../categories/types'
import type { FixedType } from '../fixed/fixedApi'
import type { Expense } from '../lib/expense'
import type { MerchantEntry } from '../merchants/merchantsApi'
import type { Entry } from '../money/entries'

export type MonthId = string

export type MonthData = {
  id: MonthId
  expenses: Expense[]
  incomes: Entry[]
  savings: Entry[]
  fixed: Record<string, number>
  rate: number | null
  rateInherited: boolean
  cap: number | null
  capInherited: boolean
}

export type SeenCard = { last4: string; type: 'credit' | 'debit'; holder: string; lastSeen: string }

export type AppConfig = {
  cards: CardsData
  seenCards: SeenCard[]
  categories: Category[]
  fixedTypes: FixedType[]
  merchants: MerchantEntry[]
  months: MonthId[]
}

export type UncategorizedItem = {
  id: string
  month: MonthId
  merchant: string
  amount: number
  currency: string
  purchaseDate: Date
  cardLast4: string
  cardType: 'credit' | 'debit'
  cardHolder: string
}
