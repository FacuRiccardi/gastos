import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AuthApi, AuthUser } from '@/auth/authApi'
import type { Expense } from '@/lib/expense'
import type { Backend } from '@/data/backend'
import { createFakeBackend } from '@/data/fakeBackend'
import { homeMonths } from '@/data/monthsFor'
import type { AppConfig, MonthData } from '@/data/types'
import { strings } from '@/strings'

const person: AuthUser = { uid: 'u1', displayName: 'Persona Uno', photoURL: null, email: 'user@example.com' }

const expense: Expense = {
  id: 'm1',
  purchaseDate: new Date('2026-03-15T03:00:00Z'),
  receivedAt: new Date('2026-03-15T18:30:00Z'),
  month: '2026-03',
  merchant: 'RECARGAS EJEMPLO',
  amount: 12500,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
}

function setup({ claim = false, backend = createFakeBackend() }: { claim?: boolean; backend?: Backend } = {}) {
  const createBackend = vi.fn(() => backend)
  let authListener: ((user: AuthUser | null) => void) | undefined
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
      createBackend={createBackend}
    />,
  )
  return {
    createBackend,
    signInAs: (user: AuthUser | null) => act(async () => authListener?.(user)),
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

  it('never creates the backend unless authorized', async () => {
    const app = setup({ claim: false })
    expect(app.createBackend).not.toHaveBeenCalled()
    await app.signInAs(null)
    expect(app.createBackend).not.toHaveBeenCalled()
    await app.signInAs(person)
    expect(app.createBackend).not.toHaveBeenCalled()
  })

  it('the header sign-out button returns to the login screen', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)

    await userEvent.click(screen.getByRole('button', { name: strings.header.signOut }))

    await waitFor(() => expect(screen.getByRole('button', { name: strings.login.button })).toBeInTheDocument())
  })

  it('an authorized app reads through the backend only, on every tab', async () => {
    const app = setup({ claim: true })
    await app.signInAs(person)
    for (const tab of [strings.tabs.expenses, strings.tabs.cards, strings.tabs.budget, strings.tabs.balance]) {
      await userEvent.click(screen.getByRole('tab', { name: tab }))
    }
    expect(app.createBackend).toHaveBeenCalledTimes(1)
  })

})

describe('App home with month documents', () => {
  const config: Partial<AppConfig> = {
    cards: {
      accounts: [{ id: 'a1', name: 'Banco Uno', owner: 'JUAN' }],
      cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
      cycles: [
        { accountId: 'a1', closingDate: '2026-08-05', dueDate: '2026-08-15' },
        { accountId: 'a1', closingDate: '2026-09-05', dueDate: '2026-09-15' },
        { accountId: 'a1', closingDate: '2026-10-05', dueDate: '2026-10-15' },
        { accountId: 'a1', closingDate: '2026-11-05', dueDate: '2026-11-16' },
      ],
    },
    categories: [{ id: 'food', name: 'Comida', color: '#111111', archived: false }],
    months: ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11'],
  }
  const month = (id: string, over: Partial<MonthData> = {}): MonthData => ({
    id,
    expenses: [],
    incomes: [],
    savings: [],
    fixed: {},
    rate: null,
    rateInherited: false,
    cap: null,
    capInherited: false,
    ...over,
  })
  const purchase: Expense = {
    ...expense,
    id: 'p1',
    month: '2026-11',
    merchant: 'SUPER EJEMPLO',
    purchaseDate: new Date('2026-11-03T03:00:00Z'),
    receivedAt: new Date('2026-11-03T15:00:00Z'),
    categoryId: null,
  }
  const seeded = (extra: Partial<AppConfig> = {}) =>
    createFakeBackend({
      config: { ...config, ...extra },
      months: ['2026-07', '2026-08', '2026-09', '2026-10'].map((id) => month(id)).concat(month('2026-11', { expenses: [purchase] })),
      uncategorized: [
        {
          id: purchase.id,
          month: purchase.month,
          merchant: purchase.merchant,
          amount: purchase.amount,
          currency: purchase.currency,
          purchaseDate: purchase.purchaseDate,
          cardLast4: purchase.cardLast4,
          cardType: purchase.cardType,
          cardHolder: purchase.cardHolder,
        },
      ],
    })
  const expectedReads = ['config', 'config', 'config', 'config', 'config', 'uncategorized', 'month:2026-09', 'month:2026-10', 'month:2026-11']
  const sorted = (list: string[]) => [...list].sort()

  async function openHome(extra: Partial<AppConfig> = {}) {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-06T15:00:00Z') })
    const backend = seeded(extra)
    const app = setup({ claim: true, backend })
    await app.signInAs(person)
    await screen.findByRole('region', { name: strings.home.closedTitle })
    return { app, backend }
  }

  afterEach(() => vi.useRealTimers())

  it('home reads config, uncategorized and only the months it needs', async () => {
    expect(homeMonths(config.cards!, config.months!, '2026-11-06')).toEqual(['2026-09', '2026-10', '2026-11'])
    const { app, backend } = await openHome()
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
    expect(app.createBackend).toHaveBeenCalledTimes(1)
    expect(screen.getByText(strings.home.uncategorized(1))).toBeInTheDocument()
  })

  it('switching to another tab and back to home reads nothing more', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.home }))
    await screen.findByRole('region', { name: strings.home.closedTitle })
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('changing a category on home updates the screen without reading', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('button', { name: strings.home.movements(1) }))
    await userEvent.click(screen.getByRole('button', { name: /····1234/ }))
    await userEvent.click(screen.getByRole('combobox', { name: strings.categories.changeAria('SUPER EJEMPLO') }))
    await userEvent.click(await screen.findByRole('option', { name: 'Comida' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: strings.categories.changeAria('SUPER EJEMPLO') })).toHaveTextContent('Comida'))
    expect(screen.queryByText(strings.home.uncategorized(1))).not.toBeInTheDocument()
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('home shows an error when a month cannot be read', async () => {
    const backend = seeded()
    backend.readMonth = async () => {
      throw new Error('permission-denied')
    }
    const app = setup({ claim: true, backend })
    await app.signInAs(person)
    expect(await screen.findByText(strings.loadError)).toBeInTheDocument()
  })
  it('the Gastos tab shows the period card of the month documents with the month selector and the total', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))
    expect(await screen.findByText(strings.gastos.periodOf('Noviembre 2026'))).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: strings.gastos.monthSelectAria })).toBeInTheDocument()
    expect(screen.getByTestId('home-total')).toHaveTextContent('12.500,00')
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('changing a category in Gastos updates the screen without reading', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.expenses }))
    await screen.findByText(strings.gastos.periodOf('Noviembre 2026'))
    await userEvent.click(screen.getByRole('button', { name: /····1234/ }))
    await userEvent.click(screen.getByRole('combobox', { name: strings.categories.changeAria('SUPER EJEMPLO') }))
    await userEvent.click(await screen.findByRole('option', { name: 'Comida' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: strings.categories.changeAria('SUPER EJEMPLO') })).toHaveTextContent('Comida'))
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('the cards tab reads no month', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    expect(screen.getByRole('tab', { name: strings.tabs.cards })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('region', { name: strings.cards.accountTitle('Banco Uno') })).toBeInTheDocument()
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('the balance tab reads the months home did not read, once', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.balance }))
    expect(await screen.findByRole('region', { name: strings.balance.title })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.home }))
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.balance }))
    await screen.findByRole('region', { name: strings.balance.title })
    expect(sorted(backend.reads)).toEqual(sorted([...expectedReads, 'month:2026-07', 'month:2026-08']))
  })

  it('the categories tab reads no month', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.categories }))
    const card = await screen.findByRole('region', { name: `${strings.tabs.toCategorize} (1)` })
    await userEvent.click(within(card).getByRole('button', { name: `${strings.tabs.toCategorize} (1)` }))
    expect(within(card).getByText('SUPER EJEMPLO')).toBeInTheDocument()
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('categorizing from the categories tab empties the list without reading', async () => {
    const { backend } = await openHome()
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.categories }))
    const card = await screen.findByRole('region', { name: `${strings.tabs.toCategorize} (1)` })
    await userEvent.click(within(card).getByRole('button', { name: `${strings.tabs.toCategorize} (1)` }))
    await userEvent.click(within(card).getByRole('combobox', { name: strings.categories.changeAria('SUPER EJEMPLO') }))
    await userEvent.click(await screen.findByRole('option', { name: 'Comida' }))
    expect(await screen.findByRole('region', { name: strings.tabs.toCategorize })).toBeInTheDocument()
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('the cards tab lists a seen card without an account from config.seenCards', async () => {
    const { backend } = await openHome({ seenCards: [{ last4: '4321', type: 'credit', holder: 'ANA', lastSeen: '2026-10-20' }] })
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    expect(await screen.findByText(strings.cards.unassignedHeading)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: '····4321' })).toBeInTheDocument()
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('assigning a seen card to an account moves it into the account without reading', async () => {
    const { backend } = await openHome({ seenCards: [{ last4: '4321', type: 'credit', holder: 'ANA', lastSeen: '2026-10-20' }] })
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    const row = await screen.findByRole('listitem', { name: '····4321' })
    await userEvent.click(within(row).getByRole('combobox', { name: strings.cards.assignAria('4321') }))
    await userEvent.click(await screen.findByRole('option', { name: 'Banco Uno' }))

    await waitFor(() => expect(screen.queryByText(strings.cards.unassignedHeading)).not.toBeInTheDocument())
    const section = screen.getByRole('region', { name: strings.cards.accountTitle('Banco Uno') })
    await userEvent.click(within(section).getByRole('button', { name: new RegExp(strings.cards.accountTitle('Banco Uno')) }))
    await userEvent.click(within(section).getByRole('button', { name: strings.cards.cardsHeading }))
    expect(within(section).getByText('····4321')).toBeInTheDocument()
    expect(within(section).getByText('····1234')).toBeInTheDocument()
    expect(sorted(backend.reads)).toEqual(sorted(expectedReads))
  })

  it('the cards tab shows an error when the config cannot be read', async () => {
    const backend = seeded()
    backend.readConfig = async () => {
      throw new Error('permission-denied')
    }
    const app = setup({ claim: true, backend })
    await app.signInAs(person)
    await userEvent.click(screen.getByRole('tab', { name: strings.tabs.cards }))
    expect(await screen.findByText(strings.loadError)).toBeInTheDocument()
  })
})
