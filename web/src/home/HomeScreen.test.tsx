import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardsData } from '@/cards/cardsApi'
import type { Category } from '@/categories/types'
import type { FixedData } from '@/fixed/fixedApi'
import type { Expense } from '@/lib/expense'
import type { Rates, RatesSource } from '@/balance/ratesApi'
import { OWNERS, type Entry, type EntriesSource } from '@/money/entries'
import { strings } from '@/strings'
import type { Caps, CapsSource } from './capsApi'
import type { CapAlertApi, CapAlertData, CapAlertSource } from './capAlertApi'
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
const ratesSource = (rates: Rates = {}): RatesSource => ({ subscribe: (onData) => (onData(rates), () => {}) })
const capAlertSource = (data: CapAlertData = { alert: null, dismissedLevel: null }): CapAlertSource => ({ subscribe: (_month, onData) => (onData(data), () => {}) })
const capAlertApi = (): CapAlertApi => ({ dismiss: vi.fn().mockResolvedValue(undefined) })

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
      ratesSource={ratesSource()}
      capAlertSource={capAlertSource()}
      capAlertApi={capAlertApi()}
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

  describe('cap alert', () => {
    const alert = { month: '2026-11', lastLevel: 50, total: 1000000, cap: 2000000 }
    const withAlert = (data: CapAlertData) => ({ capAlertSource: capAlertSource(data) })

    it('shows the banner and dismisses it, which makes it go away', async () => {
      let emit: (d: CapAlertData) => void = () => {}
      const api = capAlertApi()
      const source: CapAlertSource = {
        subscribe: (_m, onData) => {
          emit = onData
          onData({ alert, dismissedLevel: null })
          return () => {}
        },
      }
      renderHome({ capAlertSource: source, capAlertApi: api })
      expect(screen.getByRole('status')).toHaveTextContent('Superaste el 50% de tu tope')
      await userEvent.click(screen.getByRole('button', { name: s.capAlert.dismiss }))
      expect(api.dismiss).toHaveBeenCalledExactlyOnceWith('2026-11', 50)
      act(() => emit({ alert, dismissedLevel: 50 }))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows a higher level again after a lower one was dismissed', () => {
      renderHome(withAlert({ alert: { ...alert, lastLevel: 75 }, dismissedLevel: 50 }))
      expect(screen.getByRole('status')).toHaveTextContent('Superaste el 75%')
    })

    it('ignores an alert of another month', () => {
      renderHome(withAlert({ alert: { ...alert, month: '2026-10' }, dismissedLevel: null }))
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('shows next to the existing alerts', () => {
      renderHome({ ...withAlert({ alert, dismissedLevel: null }), fixed: { types: [{ id: 't1', name: 'Alquiler', disabled: false }], entries: [] } })
      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('still renders the home when the alert source fails', () => {
      renderHome({ capAlertSource: { subscribe: (_m, _d, onError) => (onError(new Error('x')), () => {}) } })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: s.currentTitle })).toBeInTheDocument()
    })

    it('keeps the banner when the dismissal fails', async () => {
      const api: CapAlertApi = { dismiss: vi.fn().mockRejectedValue(new Error('x')) }
      renderHome({ ...withAlert({ alert, dismissedLevel: null }), capAlertApi: api })
      await userEvent.click(screen.getByRole('button', { name: s.capAlert.dismiss }))
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
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

describe('HomeScreen alerts on a phone', () => {
  const original = window.matchMedia
  beforeEach(() => {
    window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
  })
  afterEach(() => {
    window.matchMedia = original
  })

  const manyAlerts = () =>
    renderHome(
      {
        fixed: { types: [{ id: 't1', name: 'Alquiler', disabled: false }], entries: [] },
        expenses: [expense({ categoryId: null }), expense({ cardLast4: '4321' })],
      },
      [],
    )

  it('folds several alerts into one line, so the total to pay stays on the first screen', () => {
    manyAlerts()
    expect(screen.getByRole('button', { name: /4 pendientes/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('shows every alert when the line is tapped', async () => {
    manyAlerts()
    await userEvent.click(screen.getByRole('button', { name: /4 pendientes/ }))
    expect(screen.getAllByRole('alert')).toHaveLength(4)
  })

  it('keeps a single alert as it is', () => {
    renderHome({ fixed: { types: [{ id: 't1', name: 'Alquiler', disabled: false }], entries: [] } })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /pendientes/ })).not.toBeInTheDocument()
  })
})

describe('HomeScreen total with dollars', () => {
  const dollars = [expense({ amount: 400 }), expense({ amount: 10, currency: 'USD' })]

  it('adds the dollar purchases at the rate of the month', () => {
    renderHome({ expenses: dollars, ratesSource: ratesSource({ '2026-11': 1500 }) })
    // 400 + 10 USD x 1500
    expect(screen.getByTestId('home-total')).toHaveTextContent('15.400,00')
    expect(screen.getByText(/Incluye .*10,00 a .*1\.500,00 \(TC de Noviembre 2026\)\./)).toBeInTheDocument()
  })

  it('without a rate for the month it uses the latest earlier one and says so', () => {
    renderHome({ expenses: dollars, ratesSource: ratesSource({ '2026-09': 1000 }) })
    expect(screen.getByTestId('home-total')).toHaveTextContent('10.400,00')
    expect(screen.getByText(/TC de Septiembre 2026, el último cargado/)).toBeInTheDocument()
  })

  it('leaves the dollars out when no rate was ever loaded', () => {
    renderHome({ expenses: dollars })
    expect(screen.getByTestId('home-total')).toHaveTextContent('400,00')
    expect(screen.queryByText(/Incluye/)).not.toBeInTheDocument()
  })
})
