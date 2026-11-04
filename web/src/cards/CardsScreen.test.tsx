import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import type { CardsApi, CardsData } from './cardsApi'
import { CardsScreen } from './CardsScreen'

const s = strings.cards

const fakeApi = (): CardsApi => ({
  createAccount: vi.fn().mockResolvedValue('new-id'),
  updateAccount: vi.fn().mockResolvedValue(undefined),
  deleteAccount: vi.fn().mockResolvedValue(undefined),
  saveCard: vi.fn().mockResolvedValue(undefined),
  removeCard: vi.fn().mockResolvedValue(undefined),
  addCycles: vi.fn().mockResolvedValue(undefined),
  deleteCycle: vi.fn().mockResolvedValue(undefined),
})

let n = 0
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: `m${++n}`,
  purchaseDate: new Date('2026-03-15T03:00:00Z'),
  receivedAt: new Date('2026-03-15T18:30:00Z'),
  merchant: 'COMERCIO',
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  ...over,
})

const data = (over: Partial<CardsData> = {}): CardsData => ({
  accounts: [],
  cards: [],
  cycles: [],
  ...over,
})

const twoAccounts = [
  { id: 'a1', name: 'Banco Uno', owner: 'JUAN' },
  { id: 'a2', name: 'Banco Dos', owner: 'MARIA' },
]

const setup = (d: CardsData, expenses: Expense[] = []) => {
  const api = fakeApi()
  const user = userEvent.setup()
  render(<CardsScreen expenses={expenses} data={d} api={api} />)
  return { api, user }
}

type User = ReturnType<typeof userEvent.setup>

// Accounts start closed: open one by its title button, then its "Tarjetas" disclosure.
async function openAccount(user: User, name: string, withCards = true) {
  const section = screen.getByRole('region', { name: s.accountTitle(name) })
  await user.click(within(section).getByRole('button', { name: new RegExp(s.accountTitle(name)) }))
  if (withCards) await user.click(within(section).getByRole('button', { name: s.cardsHeading }))
  return section
}

// The new-account form is behind the green "+" button.
async function openNewAccount(user: User) {
  await user.click(screen.getByRole('button', { name: s.newAccountHeading }))
}

describe('CardsScreen', () => {
  it('shows an empty state and offers to create an account', async () => {
    const { user } = setup(data())
    expect(screen.getByText(s.noAccounts)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: s.createAccount })).not.toBeInTheDocument()
    const plus = screen.getByRole('button', { name: s.newAccountHeading })
    expect(plus).toHaveAttribute('aria-expanded', 'false')
    await user.click(plus)
    expect(plus).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: s.createAccount })).toBeInTheDocument()
  })

  it('accounts start closed and open when their title is clicked', async () => {
    const { user } = setup(
      data({
        accounts: twoAccounts,
        cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
      }),
    )
    const section = screen.getByRole('region', { name: s.accountTitle('Banco Uno') })
    const toggle = within(section).getByRole('button', { name: new RegExp(s.accountTitle('Banco Uno')) })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(section).queryByText(s.cyclesHeading)).not.toBeInTheDocument()
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(within(section).getByText(s.cyclesHeading)).toBeInTheDocument()
    // The cards list is a closed disclosure until opened.
    expect(within(section).queryByText('····1234')).not.toBeInTheDocument()
  })

  it('"Tarjetas sin cuenta" is not shown when there are no unassigned cards', () => {
    setup(data({ accounts: twoAccounts }))
    expect(screen.queryByText(s.unassignedHeading)).not.toBeInTheDocument()
  })

  it('creating an account calls createAccount with the name and the owner in upper case', async () => {
    const { api, user } = setup(data())
    await openNewAccount(user)
    await user.type(screen.getByLabelText(s.nameLabel), 'Banco Uno')
    await user.type(screen.getByLabelText(s.ownerInputLabel), '  juan  ')
    await user.click(screen.getByRole('button', { name: s.createAccount }))
    expect(api.createAccount).toHaveBeenCalledWith({ name: 'Banco Uno', owner: 'JUAN' })
  })

  it('an account lists its cards with type, last 4 digits and holder', async () => {
    const { user } = setup(
      data({
        accounts: twoAccounts,
        cards: [
          { last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' },
          { last4: '5678', type: 'debit', holder: 'MARIA', accountId: 'a2' },
        ],
      }),
    )
    const section = await openAccount(user, 'Banco Uno')
    expect(within(section).getByText('····1234')).toBeInTheDocument()
    expect(within(section).getByText(strings.expenses.cardType.credit)).toBeInTheDocument()
    expect(within(section).getByText(s.assignedTo('JUAN'))).toBeInTheDocument()
    expect(within(section).queryByText('····5678')).not.toBeInTheDocument()
    expect(within(section).getByText(s.cyclesHeading)).toBeInTheDocument()
  })

  it('detected cards without an account are listed and assigning one calls saveCard with the holder taken from the expenses', async () => {
    const { api, user } = setup(data({ accounts: twoAccounts }), [
      expense({ cardLast4: '4321', cardHolder: 'MARIA', purchaseDate: new Date('2026-01-01T03:00:00Z') }),
      expense({ cardLast4: '4321', cardHolder: 'ANA', purchaseDate: new Date('2026-04-01T03:00:00Z') }),
    ])
    const row = screen.getByRole('listitem', { name: '····4321' })
    expect(within(row).getByText('ANA')).toBeInTheDocument()
    await user.click(within(row).getByRole('combobox', { name: s.assignAria('4321') }))
    await user.click(await screen.findByRole('option', { name: 'Banco Dos' }))
    expect(api.saveCard).toHaveBeenCalledWith({
      last4: '4321',
      type: 'credit',
      holder: 'ANA',
      accountId: 'a2',
    })
  })

  it('a card whose account does not exist is listed as without an account', () => {
    setup(
      data({
        accounts: twoAccounts,
        cards: [{ last4: '9999', type: 'debit', holder: 'JUAN', accountId: 'gone' }],
      }),
    )
    const row = screen.getByRole('listitem', { name: '····9999' })
    expect(within(row).getByRole('combobox')).toBeInTheDocument()
    for (const name of ['Banco Uno', 'Banco Dos']) {
      const section = screen.getByRole('region', { name: s.accountTitle(name) })
      expect(within(section).queryByText('····9999')).not.toBeInTheDocument()
    }
  })

  it('changing a card changes its holder and account but keeps last4 and type', async () => {
    const { api, user } = setup(
      data({
        accounts: twoAccounts,
        cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
      }),
    )
    const section = await openAccount(user, 'Banco Uno')
    await user.click(within(section).getByRole('button', { name: s.change }))
    const dialog = await screen.findByRole('dialog', { name: s.changeCardTitle('1234') })
    const holder = within(dialog).getByLabelText(s.holderLabel)
    await user.clear(holder)
    await user.type(holder, 'ana')
    await user.click(within(dialog).getByRole('combobox', { name: s.accountLabel }))
    await user.click(await screen.findByRole('option', { name: 'Banco Dos' }))
    await user.click(within(dialog).getByRole('button', { name: s.save }))
    expect(api.saveCard).toHaveBeenCalledWith({
      last4: '1234',
      type: 'credit',
      holder: 'ANA',
      accountId: 'a2',
    })
  })

  it('removing a card calls removeCard', async () => {
    const { api, user } = setup(
      data({
        accounts: twoAccounts,
        cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
      }),
    )
    await openAccount(user, 'Banco Uno')
    await user.click(screen.getByRole('button', { name: s.remove }))
    expect(api.removeCard).toHaveBeenCalledWith({ last4: '1234', type: 'credit' })
  })

  it('editing an account calls updateAccount', async () => {
    const { api, user } = setup(data({ accounts: twoAccounts }))
    const section = screen.getByRole('region', { name: s.accountTitle('Banco Uno') })
    await user.click(within(section).getByRole('button', { name: s.edit }))
    const dialog = await screen.findByRole('dialog', { name: s.editAccountTitle })
    const name = within(dialog).getByLabelText(s.nameLabel)
    await user.clear(name)
    await user.type(name, 'Banco Tres')
    const owner = within(dialog).getByLabelText(s.ownerInputLabel)
    await user.clear(owner)
    await user.type(owner, 'lucia')
    await user.click(within(dialog).getByRole('button', { name: s.save }))
    expect(api.updateAccount).toHaveBeenCalledWith('a1', { name: 'Banco Tres', owner: 'LUCIA' })
  })

  it('deleting an account asks for confirmation, cancel does nothing and confirm calls deleteAccount', async () => {
    const { api, user } = setup(data({ accounts: twoAccounts }))
    const section = screen.getByRole('region', { name: s.accountTitle('Banco Uno') })
    await user.click(within(section).getByRole('button', { name: s.delete }))
    let dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(s.deleteAccountTitle('Banco Uno'))
    await user.click(within(dialog).getByRole('button', { name: s.cancel }))
    expect(api.deleteAccount).not.toHaveBeenCalled()

    await user.click(within(section).getByRole('button', { name: s.delete }))
    dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: s.delete }))
    expect(api.deleteAccount).toHaveBeenCalledWith('a1')
  })

  it('shows an error message when an api call fails', async () => {
    const api = fakeApi()
    vi.mocked(api.createAccount).mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()
    render(<CardsScreen expenses={[]} data={data()} api={api} />)
    await openNewAccount(user)
    await user.type(screen.getByLabelText(s.nameLabel), 'Banco Uno')
    await user.type(screen.getByLabelText(s.ownerInputLabel), 'juan')
    await user.click(screen.getByRole('button', { name: s.createAccount }))
    expect(await screen.findByRole('alert')).toHaveTextContent(s.apiError)
  })

  it('creating an account twice quickly calls createAccount once and disables the button while pending', async () => {
    const api = fakeApi()
    vi.mocked(api.createAccount).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(<CardsScreen expenses={[]} data={data()} api={api} />)
    await openNewAccount(user)
    await user.type(screen.getByLabelText(s.nameLabel), 'Banco Uno')
    await user.type(screen.getByLabelText(s.ownerInputLabel), 'juan')
    const button = screen.getByRole('button', { name: s.createAccount })
    await user.click(button)
    await user.click(button)
    expect(api.createAccount).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
  })

  it('saving the change-card and edit-account dialogs disables submit while pending', async () => {
    const api = fakeApi()
    vi.mocked(api.saveCard).mockReturnValue(new Promise(() => {}))
    vi.mocked(api.updateAccount).mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    render(
      <CardsScreen
        expenses={[]}
        data={data({
          accounts: twoAccounts,
          cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
        })}
        api={api}
      />,
    )
    const section = await openAccount(user, 'Banco Uno')
    await user.click(within(section).getByRole('button', { name: s.change }))
    let dialog = await screen.findByRole('dialog', { name: s.changeCardTitle('1234') })
    let save = within(dialog).getByRole('button', { name: s.save })
    await user.click(save)
    await user.click(save)
    expect(api.saveCard).toHaveBeenCalledTimes(1)
    expect(save).toBeDisabled()
    await user.keyboard('{Escape}')

    await user.click(within(section).getByRole('button', { name: s.edit }))
    dialog = await screen.findByRole('dialog', { name: s.editAccountTitle })
    save = within(dialog).getByRole('button', { name: s.save })
    await user.click(save)
    await user.click(save)
    expect(api.updateAccount).toHaveBeenCalledTimes(1)
    expect(save).toBeDisabled()
  })

  it('a failed account edit shows the error inside the dialog and keeps it open', async () => {
    const api = fakeApi()
    vi.mocked(api.updateAccount).mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()
    render(<CardsScreen expenses={[]} data={data({ accounts: twoAccounts })} api={api} />)
    const section = screen.getByRole('region', { name: s.accountTitle('Banco Uno') })
    await user.click(within(section).getByRole('button', { name: s.edit }))
    const dialog = await screen.findByRole('dialog', { name: s.editAccountTitle })
    await user.click(within(dialog).getByRole('button', { name: s.save }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(s.apiError)
    expect(within(dialog).getByRole('button', { name: s.save })).toBeEnabled()
  })

  it('a failed card change shows the error inside the dialog and keeps it open', async () => {
    const api = fakeApi()
    vi.mocked(api.saveCard).mockRejectedValue(new Error('denied'))
    const user = userEvent.setup()
    render(
      <CardsScreen
        expenses={[]}
        data={data({
          accounts: twoAccounts,
          cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
        })}
        api={api}
      />,
    )
    const section = await openAccount(user, 'Banco Uno')
    await user.click(within(section).getByRole('button', { name: s.change }))
    const dialog = await screen.findByRole('dialog', { name: s.changeCardTitle('1234') })
    await user.click(within(dialog).getByRole('button', { name: s.save }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(s.apiError)
    expect(within(dialog).getByRole('button', { name: s.save })).toBeEnabled()
  })

  it('a failed account delete shows the error inside the dialog and confirm is not fired twice while pending', async () => {
    const api = fakeApi()
    let reject: (e: Error) => void = () => {}
    vi.mocked(api.deleteAccount).mockReturnValue(
      new Promise((_, r) => {
        reject = r
      }),
    )
    const user = userEvent.setup()
    render(<CardsScreen expenses={[]} data={data({ accounts: twoAccounts })} api={api} />)
    const section = screen.getByRole('region', { name: s.accountTitle('Banco Uno') })
    await user.click(within(section).getByRole('button', { name: s.delete }))
    const dialog = await screen.findByRole('alertdialog')
    const confirm = within(dialog).getByRole('button', { name: s.delete })
    await user.click(confirm)
    await user.click(confirm)
    expect(api.deleteAccount).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
    reject(new Error('denied'))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(s.apiError)
    expect(confirm).toBeEnabled()
  })
})
