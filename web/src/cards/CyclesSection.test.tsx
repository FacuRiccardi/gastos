import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { strings } from '@/strings'
import { CyclesSection } from './CyclesSection'
import type { Account, Cycle } from './types'

const s = strings.cards
const account: Account = { id: 'acc1', name: 'Visa Test', owner: 'ANA' }
const cycles: Cycle[] = [
  { accountId: 'acc1', closingDate: '2026-03-05', dueDate: '2026-03-15' },
  { accountId: 'acc2', closingDate: '2026-01-01', dueDate: null },
  { accountId: 'acc1', closingDate: '2026-02-05', dueDate: null },
]

function setup(list: Cycle[] = cycles) {
  const api = {
    addCycles: vi.fn().mockResolvedValue(undefined),
    deleteCycle: vi.fn().mockResolvedValue(undefined),
  }
  render(<CyclesSection account={account} cycles={list} api={api} />)
  return { api, user: userEvent.setup() }
}

type User = ReturnType<typeof userEvent.setup>

async function openList(user: User) {
  await user.click(screen.getByRole('button', { name: s.cyclesHeading }))
}

async function openBulk(user: User) {
  await user.click(screen.getByRole('button', { name: s.loadSeveralHeading }))
}

describe('CyclesSection', () => {
  it('lists the cycles of the account only, newest first, formatted dd/mm/yyyy, after opening the disclosure', async () => {
    const { user } = setup()
    await openList(user)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('05/03/2026')
    expect(rows[0]).toHaveTextContent('15/03/2026')
    expect(rows[1]).toHaveTextContent('05/02/2026')
    expect(rows[1]).toHaveTextContent('—')
    expect(screen.queryByText('01/01/2026')).not.toBeInTheDocument()
  })

  it('shows 12 rows and loads 12 more with "Cargar anteriores"', async () => {
    const many: Cycle[] = Array.from({ length: 30 }, (_, i) => ({
      accountId: 'acc1',
      closingDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
      dueDate: null,
    }))
    const { user } = setup(many)
    await openList(user)
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: s.loadPrevious }))
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(24)
    await user.click(screen.getByRole('button', { name: s.loadPrevious }))
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(30)
    expect(screen.queryByRole('button', { name: s.loadPrevious })).not.toBeInTheDocument()
  })

  it('there is no single-date form anymore', () => {
    setup()
    expect(screen.queryByLabelText(s.closingLabel)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: s.addCycle })).not.toBeInTheDocument()
  })

  it('bulk: valid lines call addCycles once with all the cycles', async () => {
    const { api, user } = setup()
    await openBulk(user)
    await user.type(await screen.findByLabelText(s.bulkLabel), '05/04/2026 15/04/2026{Enter}05/05/2026')
    await user.click(screen.getByRole('button', { name: s.loadSeveral }))
    expect(api.addCycles).toHaveBeenCalledTimes(1)
    expect(api.addCycles).toHaveBeenCalledWith('acc1', [
      { closingDate: '2026-04-05', dueDate: '2026-04-15' },
      { closingDate: '2026-05-05', dueDate: null },
    ])
  })

  it('bulk: one invalid line lists the invalid lines and writes nothing', async () => {
    const { api, user } = setup()
    await openBulk(user)
    await user.type(
      await screen.findByLabelText(s.bulkLabel),
      '05/04/2026 15/04/2026{Enter}hola{Enter}31/02/2026',
    )
    await user.click(screen.getByRole('button', { name: s.loadSeveral }))
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(new RegExp(`${s.lineLabel(2)}.*${s.cycleErrors.format}`))).toBeInTheDocument()
    expect(within(alert).getByText(new RegExp(`${s.lineLabel(3)}.*${s.cycleErrors.date}`))).toBeInTheDocument()
    expect(api.addCycles).not.toHaveBeenCalled()
  })

  it('bulk: a line that repeats a stored closing date fails the whole batch', async () => {
    const { api, user } = setup()
    await openBulk(user)
    await user.type(await screen.findByLabelText(s.bulkLabel), '05/04/2026{Enter}05/03/2026')
    await user.click(screen.getByRole('button', { name: s.loadSeveral }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(s.cycleErrors.duplicateStored)
    expect(api.addCycles).not.toHaveBeenCalled()
  })

  it('bulk: an api failure shows an error message', async () => {
    const { api, user } = setup()
    api.addCycles.mockRejectedValue(new Error('boom'))
    await openBulk(user)
    await user.type(await screen.findByLabelText(s.bulkLabel), '05/04/2026')
    await user.click(screen.getByRole('button', { name: s.loadSeveral }))
    expect(await screen.findByRole('alert')).toHaveTextContent(s.apiError)
  })

  it('delete selected stays disabled with nothing selected', async () => {
    const { user } = setup()
    await openList(user)
    expect(screen.getByRole('button', { name: s.deleteSelected(0) })).toBeDisabled()
  })

  it('deleting selected cycles asks for confirmation and then calls deleteCycle for each', async () => {
    const { api, user } = setup()
    await openList(user)
    await user.click(screen.getByRole('checkbox', { name: s.selectCycleAria('05/03/2026') }))
    await user.click(screen.getByRole('button', { name: s.deleteSelected(1) }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(s.deleteCyclesTitle(1))
    expect(api.deleteCycle).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: s.delete }))
    await waitFor(() => expect(api.deleteCycle).toHaveBeenCalledTimes(1))
    expect(api.deleteCycle).toHaveBeenCalledWith('acc1', '2026-03-05')
  })

  it('select-all selects every shown row and deletes them all', async () => {
    const { api, user } = setup()
    await openList(user)
    await user.click(screen.getByRole('checkbox', { name: s.selectAllCycles }))
    await user.click(screen.getByRole('button', { name: s.deleteSelected(2) }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: s.delete }))
    await waitFor(() => expect(api.deleteCycle).toHaveBeenCalledTimes(2))
    expect(api.deleteCycle).toHaveBeenCalledWith('acc1', '2026-03-05')
    expect(api.deleteCycle).toHaveBeenCalledWith('acc1', '2026-02-05')
  })

  it('cancelling the confirmation deletes nothing', async () => {
    const { api, user } = setup()
    await openList(user)
    await user.click(screen.getByRole('checkbox', { name: s.selectCycleAria('05/03/2026') }))
    await user.click(screen.getByRole('button', { name: s.deleteSelected(1) }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: s.cancel }))
    expect(api.deleteCycle).not.toHaveBeenCalled()
  })

  it('a failing delete shows the api error', async () => {
    const { api, user } = setup()
    api.deleteCycle.mockRejectedValue(new Error('boom'))
    await openList(user)
    await user.click(screen.getByRole('checkbox', { name: s.selectCycleAria('05/02/2026') }))
    await user.click(screen.getByRole('button', { name: s.deleteSelected(1) }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: s.delete }))
    expect(await screen.findByRole('alert')).toHaveTextContent(s.apiError)
  })
})
