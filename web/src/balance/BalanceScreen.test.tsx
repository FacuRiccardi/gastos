import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeBackend } from '@/data/fakeBackend'
import { DataProvider } from '@/data/DataProvider'
import { DataStore } from '@/data/dataStore'
import type { MonthData } from '@/data/types'
import { formatMoney } from '@/lib/format'
import { strings } from '@/strings'
import { BalanceTab } from './BalanceTab'

const s = strings.balance

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

const usd = (id: string, date: string) => ({ id, amount: 10, currency: 'USD' as const, date, owner: 'Ana' })

function renderTab() {
  const backend = createFakeBackend({
    config: { fixedTypes: [{ id: 't1', name: 'Alquiler', disabled: false }] },
    months: [
      month('2026-10', { rate: 900, incomes: [usd('i10', '2026-10-02')], fixed: { t1: 1000 } }),
      month('2026-11', { rate: 900, rateInherited: true, incomes: [usd('i11', '2026-11-02')], fixed: { t1: 2000 } }),
    ],
  })
  render(
    <DataProvider store={new DataStore(backend)}>
      <BalanceTab />
    </DataProvider>,
  )
  return backend
}
// Testing Library collapses the no-break space of the formatted money in the page, not in the text it looks for.
const ars = (amount: number) => formatMoney(amount, 'ARS').replace(/\s/g, ' ')
const monthReads = (backend: { reads: string[] }) => backend.reads.filter((r) => r.startsWith('month:')).sort()
const incomesBlock = () => screen.getByRole('region', { name: s.incomes })
const openHistory = async () => userEvent.click(await screen.findByRole('button', { name: strings.history.title }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('BalanceTab', () => {
  it('the balance tab reads every month once', async () => {
    const backend = renderTab()
    expect(await screen.findByRole('region', { name: s.title })).toBeInTheDocument()
    expect(within(incomesBlock()).getAllByText(ars(9000))).not.toHaveLength(0)
    await openHistory()
    expect(screen.getAllByRole('row')).toHaveLength(1 + 2)

    await userEvent.click(screen.getByRole('button', { name: strings.fixed.previousMonth }))
    expect(await screen.findByText(strings.gastos.monthLabel('2026-10'), { selector: '[aria-live]' })).toBeInTheDocument()
    expect(within(incomesBlock()).getAllByText(ars(9000))).not.toHaveLength(0)
    expect(monthReads(backend)).toEqual(['month:2026-10', 'month:2026-11'])
  })

  it('saving the rate clears the inherited note', async () => {
    const backend = renderTab()
    await screen.findByRole('region', { name: s.title })
    expect(within(incomesBlock()).getByText(strings.history.inheritedRate)).toBeInTheDocument()
    await openHistory()
    const table = screen.getByRole('table')
    expect(within(table).getAllByText(strings.history.inheritedRate)).toHaveLength(1)

    const input = within(incomesBlock()).getByRole('textbox', { name: s.rateLabel })
    await userEvent.clear(input)
    await userEvent.type(input, '1000')
    await userEvent.click(within(incomesBlock()).getByRole('button', { name: s.saveRate }))

    await waitFor(() => expect(within(incomesBlock()).queryByText(strings.history.inheritedRate)).not.toBeInTheDocument())
    expect(within(incomesBlock()).getAllByText(ars(10000))).not.toHaveLength(0)
    expect(within(table).queryByText(strings.history.inheritedRate)).not.toBeInTheDocument()
    expect(monthReads(backend)).toEqual(['month:2026-10', 'month:2026-11'])
  })
})
