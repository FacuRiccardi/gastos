import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BudgetTab } from '@/budget/BudgetTab'
import { createFakeBackend } from '@/data/fakeBackend'
import { DataProvider } from '@/data/DataProvider'
import { DataStore } from '@/data/dataStore'
import type { MonthData } from '@/data/types'
import { strings } from '@/strings'
import type { CapsApi } from './capsApi'
import { CapsScreen } from './CapsScreen'

const s = strings.caps

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

const renderTab = (months: MonthData[]) => {
  const backend = createFakeBackend({ months })
  render(
    <DataProvider store={new DataStore(backend)}>
      <BudgetTab initialOpen="caps" />
    </DataProvider>,
  )
  return backend
}
const monthReads = (backend: { reads: string[] }) => backend.reads.filter((r) => r.startsWith('month:'))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('CapsScreen', () => {
  const api = (): CapsApi => ({ save: vi.fn(async () => {}), remove: vi.fn(async () => {}) })

  it('shows a skeleton while the cap of the month is loading', () => {
    render(<CapsScreen month="2026-11" onMonthChange={() => {}} cap={null} api={api()} />)
    expect(screen.getByText(strings.loading)).toBeInTheDocument()
    expect(screen.queryByLabelText(s.amountLabel)).not.toBeInTheDocument()
  })

  it('has no list of defined caps nor an "in force" line', () => {
    render(<CapsScreen month="2026-11" onMonthChange={() => {}} cap={{ amount: 1000, inherited: false }} api={api()} />)
    expect(screen.getByLabelText(s.amountLabel)).toHaveValue('1000')
    expect(screen.queryByText(/rige/)).not.toBeInTheDocument()
    expect(screen.queryByText(s.inherited)).not.toBeInTheDocument()
  })

  it('removes the cap of the chosen month after confirming', async () => {
    const caps = api()
    render(<CapsScreen month="2026-11" onMonthChange={() => {}} cap={{ amount: 1000, inherited: false }} api={caps} />)
    await userEvent.click(screen.getByRole('button', { name: s.deleteAria('Noviembre 2026') }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: s.delete }))
    await waitFor(() => expect(caps.remove).toHaveBeenCalledExactlyOnceWith('2026-11'))
  })
})

describe('BudgetTab caps card', () => {
  it('caps: shows the inherited note and saving clears it', async () => {
    const backend = renderTab([month('2026-10', { cap: 400000 }), month('2026-11', { cap: 400000, capInherited: true })])
    expect(await screen.findByText(s.inherited)).toBeInTheDocument()
    const field = screen.getByLabelText(s.amountLabel)
    expect(field).toHaveValue('400000')
    await userEvent.clear(field)
    await userEvent.type(field, '500.000')
    await userEvent.click(screen.getByRole('button', { name: s.save }))
    await waitFor(() => expect(screen.queryByText(s.inherited)).not.toBeInTheDocument())
    expect(screen.getByLabelText(s.amountLabel)).toHaveValue('500000')
    expect(monthReads(backend)).toEqual(['month:2026-11'])
  })

  it('a month that does not exist yet shows what it would inherit, without reading it', async () => {
    const backend = renderTab([month('2026-10', { cap: 300000 }), month('2026-11', { cap: 400000 })])
    expect(await screen.findByLabelText(s.amountLabel)).toHaveValue('400000')
    expect(screen.queryByText(s.inherited)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: strings.fixed.nextMonth }))
    expect(await screen.findByText(s.inherited)).toBeInTheDocument()
    expect(screen.getByLabelText(s.amountLabel)).toHaveValue('400000')
    expect(monthReads(backend)).toEqual(['month:2026-11'])
  })

  it('a month with nothing before it has no cap', async () => {
    renderTab([month('2026-11', { cap: 400000 })])
    await screen.findByLabelText(s.amountLabel)
    await userEvent.click(screen.getByRole('button', { name: strings.fixed.previousMonth }))
    await waitFor(() => expect(screen.getByLabelText(s.amountLabel)).toHaveValue(''))
    expect(screen.queryByText(s.inherited)).not.toBeInTheDocument()
  })
})
