import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardsData } from '@/cards/cardsApi'
import { createFakeBackend } from '@/data/fakeBackend'
import { DataProvider } from '@/data/DataProvider'
import { DataStore } from '@/data/dataStore'
import type { AppConfig, MonthData } from '@/data/types'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import { ExpensesTab } from './ExpensesTab'
import { MonthExpenses } from './MonthExpenses'

const cards: CardsData = {
  accounts: [{ id: 'a1', name: 'Banco Uno', owner: 'JUAN' }],
  cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
  cycles: [
    { accountId: 'a1', closingDate: '2026-08-05', dueDate: '2026-08-15' },
    { accountId: 'a1', closingDate: '2026-09-05', dueDate: '2026-09-15' },
    { accountId: 'a1', closingDate: '2026-10-05', dueDate: '2026-10-15' },
    { accountId: 'a1', closingDate: '2026-11-05', dueDate: '2026-11-16' },
  ],
}
const config: Partial<AppConfig> = {
  cards,
  categories: [{ id: 'food', name: 'Comida', color: '#111111', archived: false }],
  months: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'],
}

const purchase = (id: string, merchant: string, month: string, day: string): Expense => ({
  id,
  purchaseDate: new Date(`${day}T03:00:00Z`),
  receivedAt: new Date(`${day}T15:00:00Z`),
  month,
  merchant,
  amount: 1000,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  categoryId: null,
})
const month = (id: string, expenses: Expense[] = []): MonthData => ({
  id,
  expenses,
  incomes: [],
  savings: [],
  fixed: {},
  rate: null,
  rateInherited: false,
  cap: null,
  capInherited: false,
})

describe('MonthExpenses', () => {
  afterEach(() => vi.useRealTimers())

  it('an offered month without purchases shows the empty state', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T15:00:00Z') })
    render(
      <MonthExpenses
        months={['2026-11', '2026-10']}
        month="2026-11"
        onMonthChange={() => {}}
        expenses={[]}
        cards={cards}
        categories={[]}
        caps={{}}
        rates={{}}
        loading={false}
        onCategoryChange={() => {}}
      />,
    )
    expect(screen.getByText(strings.gastos.emptyMonth)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: strings.gastos.monthSelectAria })).toBeInTheDocument()
  })

  it('shows a skeleton and keeps the selector while the month loads', () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T15:00:00Z') })
    render(
      <MonthExpenses
        months={['2026-11', '2026-10']}
        month="2026-10"
        onMonthChange={() => {}}
        expenses={[]}
        cards={cards}
        categories={[]}
        caps={{}}
        rates={{}}
        loading
        onCategoryChange={() => {}}
      />,
    )
    expect(screen.getByText(strings.loading)).toBeInTheDocument()
    expect(screen.queryByText(strings.gastos.emptyMonth)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: strings.gastos.monthSelectAria })).toBeInTheDocument()
  })
})

describe('ExpensesTab', () => {
  afterEach(() => vi.useRealTimers())

  it('choosing another month reads only the months not read yet', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T15:00:00Z') })
    const backend = createFakeBackend({
      config,
      months: [
        month('2026-07'),
        month('2026-08'),
        month('2026-09'),
        month('2026-10', [purchase('p10', 'FARMACIA EJEMPLO', '2026-10', '2026-10-03')]),
        month('2026-11', [purchase('p11', 'SUPER EJEMPLO', '2026-11', '2026-11-03')]),
      ],
    })
    render(
      <DataProvider store={new DataStore(backend)}>
        <ExpensesTab onCategoryChange={() => {}} />
      </DataProvider>,
    )
    expect(await screen.findByText(strings.gastos.periodOf('Noviembre 2026'))).toBeInTheDocument()
    expect(backend.reads.filter((r) => r.startsWith('month:')).sort()).toEqual(['month:2026-09', 'month:2026-10', 'month:2026-11'])

    await userEvent.click(screen.getByRole('combobox', { name: strings.gastos.monthSelectAria }))
    await userEvent.click(await screen.findByRole('option', { name: 'Octubre 2026' }))

    expect(await screen.findByText(strings.gastos.periodOf('Octubre 2026'))).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('combobox', { name: strings.gastos.monthSelectAria })).toHaveTextContent('Octubre 2026'))
    expect(backend.reads.filter((r) => r.startsWith('month:')).sort()).toEqual(['month:2026-08', 'month:2026-09', 'month:2026-10', 'month:2026-11'])
  })

  it('shows an error when a month cannot be read', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T15:00:00Z') })
    const backend = createFakeBackend({ config, months: [month('2026-10'), month('2026-11')] })
    backend.readMonth = async () => {
      throw new Error('permission-denied')
    }
    render(
      <DataProvider store={new DataStore(backend)}>
        <ExpensesTab onCategoryChange={() => {}} />
      </DataProvider>,
    )
    expect(await screen.findByText(strings.loadError)).toBeInTheDocument()
  })
})
