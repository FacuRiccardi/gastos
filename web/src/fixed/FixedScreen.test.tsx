import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { strings } from '@/strings'
import type { FixedApi, FixedData } from './fixedApi'
import { FixedScreen } from './FixedScreen'

const s = strings.fixed

const fakeApi = (): FixedApi => ({
  addType: vi.fn(async () => 'new'),
  renameType: vi.fn(async () => {}),
  setTypeDisabled: vi.fn(async () => {}),
  save: vi.fn(async () => {}),
  clear: vi.fn(async () => {}),
})

const data: FixedData = {
  types: [
    { id: 't1', name: 'Alquiler', disabled: false },
    { id: 't2', name: 'Expensas', disabled: false },
    { id: 't3', name: 'Garage', disabled: false },
  ],
  entries: [{ typeId: 't2', month: '2026-11', amount: 85000 }],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-04T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('FixedScreen month', () => {
  it('keeps the rows in their order and marks and counts what is still missing', () => {
    render(<FixedScreen data={data} api={fakeApi()} />)
    const month = screen.getByRole('region', { name: s.monthTitle })
    const names = within(month)
      .getAllByRole('listitem')
      .map((li) => li.textContent ?? '')
    expect(names[0]).toContain('Alquiler')
    expect(names[1]).toContain('Expensas')
    expect(names[2]).toContain('Garage')
    expect(within(month).getAllByText(s.missingBadge)).toHaveLength(2)
    expect(within(month).getByText(s.pendingCount(2))).toBeInTheDocument()
  })

  it('a row stays where it is when its amount is saved, and the count goes down', async () => {
    const { rerender } = render(<FixedScreen data={data} api={fakeApi()} />)
    rerender(<FixedScreen data={{ ...data, entries: [...data.entries, { typeId: 't1', month: '2026-11', amount: 1000 }] }} api={fakeApi()} />)
    const month = screen.getByRole('region', { name: s.monthTitle })
    const first = within(month).getAllByRole('listitem')[0]
    expect(first).toHaveTextContent('Alquiler')
    expect(within(month).getAllByText(s.missingBadge)).toHaveLength(1)
    expect(within(month).getByText(s.pendingCount(1))).toBeInTheDocument()
  })

  it('shows no count when nothing is missing', () => {
    render(
      <FixedScreen
        data={{ ...data, entries: data.types.map((t) => ({ typeId: t.id, month: '2026-11', amount: 10 })) }}
        api={fakeApi()}
      />,
    )
    expect(screen.queryByText(s.missingBadge)).not.toBeInTheDocument()
    expect(screen.queryByText(/Falta/)).not.toBeInTheDocument()
  })

  it('does not keep the text of an amount that was edited and then removed', async () => {
    const api = fakeApi()
    const { rerender } = render(<FixedScreen data={data} api={api} />)
    await userEvent.click(screen.getByRole('button', { name: s.editAria('Expensas') }))
    expect(screen.getByLabelText(s.amountAria('Expensas'))).toHaveValue('85000')
    rerender(<FixedScreen data={{ ...data, entries: [] }} api={api} />)
    expect(screen.getByLabelText(s.amountAria('Expensas'))).toHaveValue('')
  })
})
