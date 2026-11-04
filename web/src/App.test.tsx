import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AuthApi, AuthUser } from '@/auth/authApi'
import type { CategoriesApi } from '@/categories/categoriesApi'
import type { RatesApi } from '@/balance/ratesApi'
import type { CapsApi } from '@/home/capsApi'
import type { CapAlertApi } from '@/home/capAlertApi'
import type { FixedApi } from '@/fixed/fixedApi'
import type { MerchantsApi } from '@/merchants/merchantsApi'
import type { EntriesApi } from '@/money/entries'
import type { CardsApi, CardsData, CardsSource } from '@/cards/cardsApi'
import type { ExpensesSource } from '@/expenses/expensesSource'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'

const person: AuthUser = { uid: 'u1', displayName: 'Persona Uno', photoURL: null, email: 'user@example.com' }

const expense: Expense = {
  id: 'm1',
  purchaseDate: new Date('2026-03-15T03:00:00Z'),
  receivedAt: new Date('2026-03-15T18:30:00Z'),
  merchant: 'RECARGAS EJEMPLO',
  amount: 12500,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
}

const cardsData: CardsData = {
  accounts: [{ id: 'a1', name: 'Banco Uno', owner: 'JUAN' }],
  cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
  cycles: [
    { accountId: 'a1', closingDate: '2026-03-01', dueDate: null },
    { accountId: 'a1', closingDate: '2026-04-01', dueDate: null },
  ],
}

function setup({ claim = false }: { claim?: boolean } = {}) {
  let authListener: ((user: AuthUser | null) => void) | undefined
  let onData: (expenses: Expense[]) => void = () => {}
  let onError: (error: Error) => void = () => {}
  const subscribe = vi.fn((data: (e: Expense[]) => void, error: (e: Error) => void) => {
    onData = data
    onError = error
    return () => {}
  })
  const source: ExpensesSource = { subscribe }
  const createExpensesSource = vi.fn(() => source)
  let onCards: (data: CardsData) => void = () => {}
  let onCardsError: (error: Error) => void = () => {}
  const cardsSubscribe = vi.fn((data: (d: CardsData) => void, error: (e: Error) => void) => {
    onCards = data
    onCardsError = error
    return () => {}
  })
  const cardsSource: CardsSource = { subscribe: cardsSubscribe }
  const createCardsSource = vi.fn(() => cardsSource)
  const createCardsApi = vi.fn(() => ({}) as CardsApi)
  const authApi: AuthApi = {
    onAuthChange: vi.fn((cb) => {
      authListener = cb
      return () => {}
    }),
    hasHouseholdClaim: vi.fn(async () => claim),
    signInWithGoogle: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      authListener?.(null)
    }),
  }
  render(
    <App
      authApi={authApi}
      createExpensesSource={createExpensesSource}
      createCardsSource={createCardsSource}
      createCardsApi={createCardsApi}
      createCategoriesSource={() => ({ subscribe: (onData) => { onData([]); return () => {} } })}
      createCategoriesApi={() => ({}) as CategoriesApi}
      createEntriesSource={() => ({ subscribe: (onData) => { onData([]); return () => {} } })}
      createEntriesApi={() => ({}) as EntriesApi}
      createMerchantsApi={() => ({}) as MerchantsApi}
      createMerchantsSource={() => ({ subscribe: (onData) => { onData([]); return () => {} } })}
      createFixedSource={() => ({ subscribe: (onData) => { onData({ types: [], entries: [] }); return () => {} } })}
      createFixedApi={() => ({}) as FixedApi}
      createRatesSource={() => ({ subscribe: (onData) => { onData({}); return () => {} } })}
      createRatesApi={() => ({}) as RatesApi}
      createCapsSource={() => ({ subscribe: (onData) => { onData({}); return () => {} } })}
      createCapsApi={() => ({}) as CapsApi}
      createCapAlertSource={() => ({ subscribe: (_month, onData) => { onData({ alert: null, dismissedLevel: null }); return () => {} } })}
      createCapAlertApi={() => ({}) as CapAlertApi}
    />,
  )
  return {
    createExpensesSource,
    createCardsSource,
    createCardsApi,
    subscribe,
    cardsSubscribe,
    emitCards: (d: CardsData) => act(() => onCards(d)),
    failCards: (e: Error) => act(() => onCardsError(e)),
    signInAs: (user: AuthUser | null) => act(async () => authListener?.(user)),
    emitExpenses: (e: Expense[]) => act(() => onData(e)),
    failExpenses: (e: Error) => act(() => onError(e)),
  }
}

describe('App', () => {
  afterEach(() => vi.useRealTimers())

  it('shows a loading indicator until Firebase reports the session', () => {
    setup()
    expect(screen.getByText(strings.loading)).toBeInTheDocument()
  })

  it('shows the login screen when signed out', async () => {
    const app = setup()
    await app.signInAs(null)
    expect(screen.getByRole('button', { name: strings.login.button })).toBeInTheDocument()
  })

  it('shows the no-access screen when unauthorized', async () => {
    const app = setup({ claim: false })
    await app.signInAs(person)
    expect(screen.getByText(strings.noAccess.message)).toBeInTheDocument()
  })

  it('never creates or subscribes to the expenses source unless authorized', async () => {
    const app = setup({ claim: false })
    // loading
    expect(app.createExpensesSource).not.toHaveBeenCalled()
    // signed out
    await app.signInAs(null)
    expect(app.createExpensesSource).not.toHaveBeenCalled()
    // signed in without the claim
    await app.signInAs(person)
    expect(app.createExpensesSource).not.toHaveBeenCalled()
    expect(app.subscribe).not.toHaveBeenCalled()
  })

  it('the Gastos tab shows the period card with the month selector and the total to pay', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-04-10T12:00:00Z') })
    const app = setup({ claim: true })
    await app.signInAs(person)

    app.emitExpenses([expense])
    app.emitCards(cardsData)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))

    expect(screen.getByRole('combobox', { name: strings.gastos.monthSelectAria })).toBeInTheDocument()
    expect(screen.getByText(/Período de /)).toBeInTheDocument()
    expect(screen.getByTestId('home-total')).toHaveTextContent('12.500,00')
    expect(screen.getByText(person.displayName as string)).toBeInTheDocument()
  })

  it('Gastos shows loading until both expenses and cards arrive', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))
    expect(screen.getByText(strings.loading)).toBeInTheDocument()

    app.emitExpenses([expense])
    expect(screen.getByText(strings.loading)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: strings.gastos.monthSelectAria })).not.toBeInTheDocument()

    app.emitCards(cardsData)
    expect(screen.queryByText(strings.loading)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: strings.gastos.monthSelectAria })).toBeInTheDocument()
  })

  it('Gastos shows an error and no totals when the cards subscription fails (permission-denied)', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitExpenses([expense])

    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))
    app.failCards(new Error('permission-denied'))

    expect(screen.getByRole('alert')).toHaveTextContent(strings.cards.error)
    expect(screen.queryByRole('combobox', { name: strings.gastos.monthSelectAria })).not.toBeInTheDocument()
  })

  it('shows an error message when the expenses subscription fails after being authorized', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitExpenses([expense])
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))

    app.failExpenses(new Error('permission-denied'))

    expect(screen.getByText(strings.expenses.error)).toBeInTheDocument()
    expect(screen.queryByText(/RECARGAS EJEMPLO/)).not.toBeInTheDocument()
  })

  it('Gastos shows an error and no totals when the expenses subscription fails even if the cards arrived', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitCards(cardsData)
    app.emitExpenses([expense])

    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))
    app.failExpenses(new Error('permission-denied'))

    expect(screen.getByRole('alert')).toHaveTextContent(strings.expenses.error)
    expect(screen.queryByRole('combobox', { name: strings.gastos.monthSelectAria })).not.toBeInTheDocument()
  })

  it('the header sign-out button returns to the login screen', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitExpenses([expense])

    await userEvent.click(screen.getByRole('button', { name: strings.header.signOut }))

    await waitFor(() => expect(screen.getByRole('button', { name: strings.login.button })).toBeInTheDocument())
  })

  it('never creates the cards source or the cards api unless authorized', async () => {
    const app = setup({ claim: false })
    expect(app.createCardsSource).not.toHaveBeenCalled()
    expect(app.createCardsApi).not.toHaveBeenCalled()
    await app.signInAs(null)
    expect(app.createCardsSource).not.toHaveBeenCalled()
    expect(app.createCardsApi).not.toHaveBeenCalled()
    await app.signInAs(person)
    expect(app.createCardsSource).not.toHaveBeenCalled()
    expect(app.createCardsApi).not.toHaveBeenCalled()
  })

  it('shows the Inicio tab by default and switches to Tarjetas', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitExpenses([expense])
    app.emitCards(cardsData)
    expect(screen.getByRole('tab', { name: strings.tabs.home })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('region', { name: strings.cards.accountTitle('Banco Uno') })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))

    expect(screen.getByRole('tab', { name: strings.tabs.cards })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: strings.tabs.home })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('region', { name: strings.cards.accountTitle('Banco Uno') })).toBeInTheDocument()
  })

  it('the Tarjetas tab shows the accounts from the source', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitExpenses([expense])
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    expect(screen.getByText(strings.loading)).toBeInTheDocument()

    app.emitCards({ accounts: [{ id: 'a1', name: 'Banco Uno', owner: 'JUAN' }], cards: [], cycles: [] })

    expect(await screen.findByText(/Banco Uno/)).toBeInTheDocument()
  })

  it('shows an error message in the Tarjetas tab when its subscription fails (permission-denied)', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitExpenses([expense])
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))

    app.failCards(new Error('permission-denied'))

    expect(screen.getByRole('alert')).toHaveTextContent(strings.cards.error)
  })

  it('expenses and cards are each subscribed once, also after switching tabs', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    app.emitExpenses([expense])
    app.emitCards(cardsData)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    expect(app.subscribe).toHaveBeenCalledTimes(1)
    expect(app.cardsSubscribe).toHaveBeenCalledTimes(1)
  })

  it('never subscribes to the cards source unless authorized', async () => {
    const app = setup({ claim: false })
    await app.signInAs(null)
    await app.signInAs(person)
    expect(app.cardsSubscribe).not.toHaveBeenCalled()
  })

  it('does not show the unassigned cards section while the expenses are loading', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))

    app.emitCards({ accounts: [{ id: 'a1', name: 'Banco Uno', owner: 'JUAN' }], cards: [], cycles: [] })

    expect(await screen.findByText(/Banco Uno/)).toBeInTheDocument()
    expect(screen.queryByText(strings.cards.unassignedHeading)).not.toBeInTheDocument()
    expect(screen.queryByText(strings.cards.noUnassigned)).not.toBeInTheDocument()
  })

  it('does not show the unassigned cards section when the expenses fail', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    app.failExpenses(new Error('permission-denied'))

    app.emitCards({ accounts: [{ id: 'a1', name: 'Banco Uno', owner: 'JUAN' }], cards: [], cycles: [] })

    expect(await screen.findByText(/Banco Uno/)).toBeInTheDocument()
    expect(screen.queryByText(strings.cards.unassignedHeading)).not.toBeInTheDocument()
    expect(screen.queryByText(strings.cards.noUnassigned)).not.toBeInTheDocument()
  })

  it('shows the unassigned cards section once the expenses are ready and a card has no account', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    app.emitCards({ accounts: [{ id: 'a1', name: 'Banco Uno', owner: 'JUAN' }], cards: [], cycles: [] })
    app.emitExpenses([{ ...expense, cardLast4: '4321' }])

    expect(await screen.findByText(strings.cards.unassignedHeading)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '····4321' })).toBeInTheDocument()
  })

  it('creates the cards source and api exactly once when authorized, even after switching tabs', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    expect(app.createCardsSource).toHaveBeenCalledTimes(1)
    expect(app.createCardsApi).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    expect(app.createCardsSource).toHaveBeenCalledTimes(1)
    expect(app.createCardsApi).toHaveBeenCalledTimes(1)
  })
})
