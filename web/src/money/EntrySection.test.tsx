import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatMoney } from '@/lib/format'
import { strings } from '@/strings'
import { OWNERS, type Entry, type EntriesApi } from './entries'
import { EntrySection } from './EntrySection'

const s = strings.money
const MONEY = formatMoney(1000, 'ARS')
const labels = { title: s.incomes.title, add: s.incomes.add, empty: s.incomes.empty }

const entry = (id: string, over: Partial<Entry> = {}): Entry => ({ id, amount: 1000, currency: 'ARS', date: '2026-11-02', ...over })
const fakeApi = (): EntriesApi & { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } => ({
  add: vi.fn(async () => 'new-id'),
  remove: vi.fn(async () => {}),
})

function renderSection(entries: Entry[], api = fakeApi(), withOwner = false) {
  render(<EntrySection labels={labels} entries={entries} api={api} withOwner={withOwner} />)
  return api
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('EntrySection table', () => {
  it('says the list is empty and has no table or delete button', () => {
    renderSection([])
    expect(screen.getByText(s.incomes.empty)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar seleccionados/ })).not.toBeInTheDocument()
  })

  it('shows one row per entry with date and money, and no total of the whole history', () => {
    renderSection([entry('a', { amount: 1500.5 }), entry('b', { amount: 20, currency: 'USD', date: '2026-10-15' }), entry('c', { amount: 500 })])
    expect(screen.getAllByRole('row')).toHaveLength(1 + 3)
    expect(screen.getByText('15/10/2026')).toBeInTheDocument()
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument()
  })

  it('shows the owner column only with owners, with a dash when an entry has none', () => {
    const owner = OWNERS[0]
    renderSection([entry('a', { owner }), entry('b')], fakeApi(), true)
    expect(screen.getByRole('columnheader', { name: s.columns.owner })).toBeInTheDocument()
    expect(screen.getByText(owner)).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('loads more rows on demand when there are over 12', async () => {
    const many = Array.from({ length: 15 }, (_, i) => entry(`e${i}`, { amount: i + 1 }))
    renderSection(many)
    expect(screen.getAllByRole('row')).toHaveLength(1 + 12)
    await userEvent.click(screen.getByRole('button', { name: s.loadPrevious }))
    expect(screen.getAllByRole('row')).toHaveLength(1 + 15)
    expect(screen.queryByRole('button', { name: s.loadPrevious })).not.toBeInTheDocument()
  })
})

describe('EntrySection selection and deletion', () => {
  const deleteButton = (n: number) => screen.getByRole('button', { name: s.deleteSelected(n) })

  it('the delete button is disabled until something is selected and counts the selection', async () => {
    renderSection([entry('a'), entry('b', { date: '2026-11-03' })])
    expect(deleteButton(0)).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox', { name: s.selectAria('02/11/2026', MONEY) }))
    expect(deleteButton(1)).toBeEnabled()
  })

  it('select-all selects every shown row and a second click clears them', async () => {
    renderSection([entry('a'), entry('b', { date: '2026-11-03' })])
    await userEvent.click(screen.getByRole('checkbox', { name: s.selectAll }))
    expect(deleteButton(2)).toBeEnabled()
    await userEvent.click(screen.getByRole('checkbox', { name: s.selectAll }))
    expect(deleteButton(0)).toBeDisabled()
  })

  it('asks for confirmation and deletes nothing if cancelled', async () => {
    const api = renderSection([entry('a')])
    await userEvent.click(screen.getByRole('checkbox', { name: s.selectAria('02/11/2026', MONEY) }))
    await userEvent.click(deleteButton(1))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(s.deleteManyTitle(1))).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: s.cancel }))
    expect(api.remove).not.toHaveBeenCalled()
  })

  it('removes every selected entry once confirmed', async () => {
    const api = renderSection([entry('a'), entry('b', { date: '2026-11-03' }), entry('c', { date: '2026-11-04' })])
    await userEvent.click(screen.getByRole('checkbox', { name: s.selectAria('02/11/2026', MONEY) }))
    await userEvent.click(screen.getByRole('checkbox', { name: s.selectAria('04/11/2026', MONEY) }))
    await userEvent.click(deleteButton(2))
    const dialog = await screen.findByRole('alertdialog')
    await userEvent.click(within(dialog).getByRole('button', { name: s.delete }))
    await waitFor(() => expect(api.remove).toHaveBeenCalledTimes(2))
    expect(api.remove.mock.calls.map((c) => c[0]).sort()).toEqual(['a', 'c'])
  })

  it('shows an error when deleting fails', async () => {
    const api = fakeApi()
    api.remove.mockRejectedValue(new Error('boom'))
    renderSection([entry('a')], api)
    await userEvent.click(screen.getByRole('checkbox', { name: s.selectAria('02/11/2026', MONEY) }))
    await userEvent.click(deleteButton(1))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: s.delete }))
    expect(await screen.findByText(s.apiError)).toBeInTheDocument()
  })
})

describe('EntrySection new entry form', () => {
  const openForm = async () => userEvent.click(screen.getByRole('button', { name: labels.add }))

  it('is closed until the plus button is clicked, and closes with it', async () => {
    renderSection([])
    expect(screen.queryByRole('form', { name: labels.add })).not.toBeInTheDocument()
    await openForm()
    expect(screen.getByRole('form', { name: labels.add })).toBeInTheDocument()
    await openForm()
    expect(screen.queryByRole('form', { name: labels.add })).not.toBeInTheDocument()
  })

  it('starts with today in Buenos Aires as the date', async () => {
    renderSection([])
    await openForm()
    expect(screen.getByLabelText(s.dateLabel)).toHaveValue('2026-11-04')
  })

  it('saves a valid amount typed the Argentine way and closes the form', async () => {
    const api = renderSection([])
    await openForm()
    await userEvent.type(screen.getByLabelText(s.amountLabel), '1.500,50')
    await userEvent.click(screen.getByRole('button', { name: s.save }))
    await waitFor(() => expect(api.add).toHaveBeenCalledExactlyOnceWith({ amount: 1500.5, currency: 'ARS', date: '2026-11-04' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: labels.add })).not.toBeInTheDocument())
  })

  it.each([['', 'empty'], ['0', 'zero'], ['-5', 'negative'], ['abc', 'text']])('rejects an amount that is %j (%s) without saving', async (text) => {
    const api = renderSection([])
    await openForm()
    if (text) await userEvent.type(screen.getByLabelText(s.amountLabel), text)
    await userEvent.click(screen.getByRole('button', { name: s.save }))
    expect(screen.getByRole('alert')).toHaveTextContent(s.invalidAmount)
    expect(api.add).not.toHaveBeenCalled()
  })

  it('rejects an empty date without saving', async () => {
    const api = renderSection([])
    await openForm()
    await userEvent.type(screen.getByLabelText(s.amountLabel), '100')
    await userEvent.clear(screen.getByLabelText(s.dateLabel))
    await userEvent.click(screen.getByRole('button', { name: s.save }))
    expect(screen.getByRole('alert')).toHaveTextContent(s.invalidDate)
    expect(api.add).not.toHaveBeenCalled()
  })

  it('asks who the income is from when owners are used and none was chosen', async () => {
    const api = renderSection([], fakeApi(), true)
    await openForm()
    await userEvent.type(screen.getByLabelText(s.amountLabel), '100')
    await userEvent.click(screen.getByRole('button', { name: s.save }))
    expect(screen.getByRole('alert')).toHaveTextContent(s.invalidOwner)
    expect(api.add).not.toHaveBeenCalled()
  })

  it('shows an error and keeps the form when saving fails', async () => {
    const api = fakeApi()
    api.add.mockRejectedValue(new Error('boom'))
    renderSection([], api)
    await openForm()
    await userEvent.type(screen.getByLabelText(s.amountLabel), '100')
    await userEvent.click(screen.getByRole('button', { name: s.save }))
    expect(await screen.findByText(s.apiError)).toBeInTheDocument()
    expect(screen.getByRole('form', { name: labels.add })).toBeInTheDocument()
  })
})

describe('EntrySection date in words', () => {
  it('writes the chosen date out, so dd/mm and mm/dd cannot be mixed up', async () => {
    renderSection([])
    await userEvent.click(screen.getByRole('button', { name: labels.add }))
    expect(screen.getByText('Miércoles, 4 de noviembre de 2026')).toBeInTheDocument()
  })
})
