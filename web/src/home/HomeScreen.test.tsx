import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardsData } from '@/cards/cardsApi'
import type { Category } from '@/categories/types'
import type { FixedData } from '@/fixed/fixedApi'
import type { Expense } from '@/lib/expense'
import { OWNERS, type Entry, type EntriesSource } from '@/money/entries'
import { strings } from '@/strings'
import type { Caps, CapsSource } from './capsApi'
import { HomeScreen } from './HomeScreen'

const s = strings.home

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
  categoryId: 'food',
  ...over,
})

const categories: Category[] = [{ id: 'food', name: 'Comida', color: '#111111' }]
const cards: CardsData = {
  accounts: [{ id: 'a1', name: 'Cuenta de ejemplo', owner: 'JUAN' }],
  cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
  cycles: [
    { accountId: 'a1', closingDate: '2026-09-05', dueDate: '2026-09-15' },
    { accountId: 'a1', closingDate: '2026-10-05', dueDate: '2026-10-15' },
    { accountId: 'a1', closingDate: '2026-11-05', dueDate: '2026-11-16' },
  ],
}
const fixedComplete: FixedData = {
  types: [{ id: 't1', name: 'Alquiler', disabled: false }],
  entries: [{ typeId: 't1', month: '2026-11', amount: 500000 }],
}
// One income this month for every owner.
const incomesComplete: Entry[] = OWNERS.map((owner, i) => ({ id: `i${i}`, amount: 1000, currency: 'ARS', date: '2026-11-01', owner }))

const incomesSource = (entries: Entry[]): EntriesSource => ({ subscribe: (onData) => (onData(entries), () => {}) })
const capsSource = (caps: Caps): CapsSource => ({ subscribe: (onData) => (onData(caps), () => {}) })

function renderHome(over: Partial<Parameters<typeof HomeScreen>[0]> = {}, incomes: Entry[] = incomesComplete, caps: Caps = { '2026-11': 1000 }) {
  const onNavigate = vi.fn()
  render(
    <HomeScreen
      expenses={[expense({ amount: 400 })]}
      cards={cards}
      fixed={fixedComplete}
      categories={categories}
      incomesSource={incomesSource(incomes)}
      capsSource={capsSource(caps)}
      onCategoryChange={vi.fn()}
      onNavigate={onNavigate}
      {...over}
    />,
  )
  return onNavigate
}

beforeEach(() => {
  // Only the clock: timers keep running for Testing Library.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('HomeScreen', () => {
  it('shows no alerts when nothing is missing', () => {
    renderHome()
    expect(screen.queryByLabelText(s.alertsAria)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: s.goFixed })).not.toBeInTheDocument()
    // the period still shows: the cap bar is not an alert
    expect(screen.getByRole('region', { name: s.currentTitle })).toBeInTheDocument()
    expect(screen.getByTestId('home-total')).toHaveTextContent('400,00')
  })

  it('shows the current period against the cap of the current month', () => {
    renderHome()
    expect(screen.getByRole('progressbar', { name: s.capProgressAria })).toHaveAttribute('data-level', 'green')
  })

  it('hides the closed period after its due date has passed', () => {
    renderHome()
    expect(screen.queryByRole('region', { name: s.closedTitle })).not.toBeInTheDocument()
  })

  it('shows the closed period while it has not fallen due', () => {
    vi.setSystemTime(new Date('2026-10-12T15:00:00Z'))
    renderHome({ expenses: [expense({ purchaseDate: new Date('2026-09-20T15:00:00Z') })] }, [], {})
    expect(screen.getByRole('region', { name: s.closedTitle })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: s.currentTitle })).toBeInTheDocument()
  })

  it('says there are no periods when there are no card cycles', () => {
    renderHome({ cards: { accounts: [], cards: [], cycles: [] }, expenses: [] })
    expect(screen.getByText(s.noPeriods)).toBeInTheDocument()
  })

  describe('alerts', () => {
    const alert = (name: RegExp | string) => screen.getByText(name).closest('[role="alert"]') as HTMLElement

    it('missing fixed expenses is a high alert that goes to "fixed"', async () => {
      const onNavigate = renderHome({ fixed: { types: [{ id: 't1', name: 'Alquiler', disabled: false }, { id: 't2', name: 'Expensas', disabled: false }], entries: [] } })
      const a = alert(/Faltan cargar gastos fijos de .*: Alquiler, Expensas\./)
      expect(a).toHaveAttribute('data-level', 'high')
      await userEvent.click(within(a).getByRole('button', { name: s.goFixed }))
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith('fixed')
    })

    it('a fixed expense type already loaded this month, or disabled, is not missing', () => {
      renderHome({
        fixed: {
          types: [
            { id: 't1', name: 'Alquiler', disabled: false },
            { id: 't2', name: 'Expensas', disabled: true },
            { id: 't3', name: 'Gas', disabled: false },
          ],
          // Gas has an entry, but of the previous month: it is still missing
          entries: [{ typeId: 't1', month: '2026-11', amount: 1 }, { typeId: 't3', month: '2026-10', amount: 1 }],
        },
      })
      expect(alert(/Faltan cargar gastos fijos/)).toHaveTextContent(/: Gas\./)
    })

    it('lists at most three names and counts the rest', () => {
      const types = ['Alquiler', 'Expensas', 'Gas', 'Luz', 'Agua'].map((name, i) => ({ id: `t${i}`, name, disabled: false }))
      renderHome({ fixed: { types, entries: [] } })
      expect(alert(/Faltan cargar gastos fijos/)).toHaveTextContent('Alquiler, Expensas, Gas y 2 más.')
    })

    it('a missing income is a high alert that goes to "money" and names who is missing', async () => {
      const onNavigate = renderHome({}, incomesComplete.slice(1))
      const a = alert(/Falta cargar el ingreso de/)
      expect(a).toHaveAttribute('data-level', 'high')
      expect(a).toHaveTextContent(OWNERS[0])
      await userEvent.click(within(a).getByRole('button', { name: s.goIncome }))
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith('money')
    })

    it('an income of another month does not count for this month', () => {
      renderHome({}, incomesComplete.map((i) => ({ ...i, date: '2026-10-31' })))
      expect(alert(/Falta cargar el ingreso de/)).toBeInTheDocument()
    })

    it('uncategorized purchases are a medium alert that goes to "toCategorize"', async () => {
      const onNavigate = renderHome({ expenses: [expense({ categoryId: null }), expense({ categoryId: 'deleted' }), expense()] })
      const a = alert('Hay 2 compras sin categorizar.')
      expect(a).toHaveAttribute('data-level', 'medium')
      await userEvent.click(within(a).getByRole('button', { name: s.goCategorize }))
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith('toCategorize')
    })

    it('rejected purchases do not count as uncategorized', () => {
      renderHome({ expenses: [expense({ categoryId: null, status: 'rejected' })] })
      expect(screen.queryByText(/sin categorizar/)).not.toBeInTheDocument()
    })

    it('a new card without account is a low alert that goes to "cards"', async () => {
      const onNavigate = renderHome({ expenses: [expense(), expense({ cardLast4: '4321' })] })
      const a = alert(/tarjeta nueva sin cuenta asignada/)
      expect(a).toHaveAttribute('data-level', 'low')
      expect(a).toHaveTextContent('····4321')
      await userEvent.click(within(a).getByRole('button', { name: s.goCards }))
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith('cards')
    })

    it('shows the four alerts together, most urgent first', () => {
      renderHome({
        fixed: { types: [{ id: 't1', name: 'Alquiler', disabled: false }], entries: [] },
        expenses: [expense({ categoryId: null }), expense({ cardLast4: '4321' })],
      }, [])
      const levels = within(screen.getByLabelText(s.alertsAria))
        .getAllByRole('alert')
        .map((a) => a.getAttribute('data-level'))
      expect(levels).toEqual(['high', 'high', 'medium', 'low'])
    })
  })

  describe('loading and errors', () => {
    it('shows the error when the incomes cannot be read', () => {
      renderHome({ incomesSource: { subscribe: (_onData, onError) => (onError(new Error('x')), () => {}) } })
      expect(screen.getByRole('alert')).toHaveTextContent(strings.money.error)
    })

    it('shows the error when the caps cannot be read', () => {
      renderHome({ capsSource: { subscribe: (_onData, onError) => (onError(new Error('x')), () => {}) } })
      expect(screen.getByRole('alert')).toHaveTextContent(s.error)
    })

    it('shows neither periods nor alerts while loading', () => {
      renderHome({ incomesSource: { subscribe: () => () => {} } })
      expect(screen.queryByRole('region', { name: s.currentTitle })).not.toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
