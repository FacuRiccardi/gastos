import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CardsData } from '@/cards/cardsApi'
import { buildAccountViews } from '@/expenses/statements'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import { buildHomePeriods, type PeriodGroup } from './homePeriods'
import { PeriodCard } from './PeriodCard'

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
  ...over,
})

const data: CardsData = {
  accounts: [{ id: 'a1', name: 'Cuenta de ejemplo', owner: 'JUAN' }],
  cards: [{ last4: '1234', type: 'credit', holder: 'JUAN', accountId: 'a1' }],
  cycles: [
    { accountId: 'a1', closingDate: '2026-09-05', dueDate: '2026-09-15' },
    { accountId: 'a1', closingDate: '2026-10-05', dueDate: '2026-10-15' },
    { accountId: 'a1', closingDate: '2026-11-05', dueDate: '2026-11-16' },
  ],
}

// The current period of Oct 12 (Oct 6 - Nov 5; month 2026-11) with a total of `amount` pesos.
function currentGroup(amount: number, extra: Expense[] = []): PeriodGroup {
  const views = buildAccountViews([expense({ amount, merchant: 'TIENDA UNO' }), ...extra], data)
  return buildHomePeriods(views, data.cycles, '2026-10-12').current!
}

function renderCard(group: PeriodGroup, caps: Record<string, number>, props: Partial<Parameters<typeof PeriodCard>[0]> = {}) {
  return render(<PeriodCard group={group} caps={caps} categories={[]} onCategoryChange={vi.fn()} {...props} />)
}

describe('PeriodCard', () => {
  it('shows the title, the total to pay and the account line', () => {
    renderCard(currentGroup(1500), { '2026-11': 10000 })
    const card = screen.getByRole('region', { name: strings.home.currentTitle })
    expect(within(card).getByTestId('home-total')).toHaveTextContent('1.500,00')
    expect(within(card).getByText(/Cuenta de ejemplo/)).toBeInTheDocument()
    expect(within(card).queryByText(strings.home.closedBadge)).not.toBeInTheDocument()
  })

  it('a closed period has the Cerrado badge and the due date of each account', () => {
    const views = buildAccountViews([expense({ amount: 10, purchaseDate: new Date('2026-09-20T15:00:00Z') })], data)
    const closed = buildHomePeriods(views, data.cycles, '2026-10-12').closed!
    renderCard(closed, {})
    expect(screen.getByRole('region', { name: strings.home.closedTitle })).toBeInTheDocument()
    expect(screen.getByText(strings.home.closedBadge)).toBeInTheDocument()
    expect(screen.getByText(/vence el 15\/10\/2026/)).toBeInTheDocument()
  })

  it('shows the note that foreign currency is left out only when the group has it', () => {
    // Without a cap there is no percentage tooltip, so the only "more info" button would be the foreign-currency note.
    const { unmount } = renderCard(currentGroup(100), {})
    expect(screen.queryByRole('button', { name: strings.moreInfo })).not.toBeInTheDocument()
    unmount()
    renderCard(currentGroup(100, [expense({ amount: 5, currency: 'USD' })]), {})
    expect(screen.getByRole('button', { name: strings.moreInfo })).toBeInTheDocument()
  })

  it('explains the cap percentage and the comparison with a tooltip each', () => {
    renderCard(currentGroup(100), { '2026-11': 1000 }, { previous: { month: '2026-10', total: 200 } })
    expect(screen.getAllByRole('button', { name: strings.moreInfo })).toHaveLength(2)
  })

  describe('spending cap bar', () => {
    const bar = () => screen.getByRole('progressbar', { name: strings.home.capProgressAria })

    it.each([
      [400, 'green', '40%'],
      [500, 'yellow', '50%'],
      [750, 'orange', '75%'],
      [990, 'orange', '99%'],
    ])('with %d of 1000 spent the bar is %s and shows %s', (amount, level, percent) => {
      renderCard(currentGroup(amount), { '2026-11': 1000 })
      expect(bar()).toHaveAttribute('data-level', level)
      expect(screen.getByText(percent)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('with the cap exactly reached it is red and shows a zero excess with the warning', () => {
      renderCard(currentGroup(1000), { '2026-11': 1000 })
      expect(bar()).toHaveAttribute('data-level', 'red')
      expect(screen.getByLabelText(strings.home.exceededBy)).toHaveTextContent('+$ 0,00 (+0%)')
      expect(screen.getByRole('alert')).toHaveTextContent(strings.home.capExceeded)
    })

    it('past the cap it shows the excess in money and in percent and the warning', () => {
      renderCard(currentGroup(1250), { '2026-11': 1000 })
      expect(bar()).toHaveAttribute('data-level', 'red')
      expect(bar()).toHaveAttribute('aria-valuenow', '100')
      expect(screen.getByLabelText(strings.home.exceededBy)).toHaveTextContent('+$ 250,00 (+25%)')
      expect(screen.getByText('125%')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Se superó el Tope de gasto')
    })

    it('uses the latest cap defined before the month when the month has none', () => {
      renderCard(currentGroup(400), { '2026-05': 1000 })
      expect(bar()).toHaveAttribute('data-level', 'green')
    })

    it('without any cap it asks to define one and shows no bar', () => {
      renderCard(currentGroup(400), {})
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      expect(screen.getByText(/Todavía no hay un tope de gasto definido para/)).toBeInTheDocument()
    })

    it('a cap defined only for a later month does not apply', () => {
      renderCard(currentGroup(400), { '2026-12': 1000 })
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })
  })

  describe('movements', () => {
    it('are collapsed behind a toggle that shows how many there are, and open on click', async () => {
      const user = userEvent.setup()
      renderCard(currentGroup(100), { '2026-11': 1000 })
      expect(screen.queryByText('TIENDA UNO')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: strings.home.movements(1) }))
      expect(screen.getByRole('region', { name: strings.cards.accountTitle('Cuenta de ejemplo') })).toBeInTheDocument()
    })

    it('with alwaysShowMovements they show with no toggle', () => {
      renderCard(currentGroup(100), { '2026-11': 1000 }, { alwaysShowMovements: true })
      expect(screen.queryByRole('button', { name: strings.home.movements(1) })).not.toBeInTheDocument()
      expect(screen.getByRole('region', { name: strings.cards.accountTitle('Cuenta de ejemplo') })).toBeInTheDocument()
    })

    it('an empty period says there are no purchases', () => {
      const views = buildAccountViews([], data)
      const group = buildHomePeriods(views, data.cycles, '2026-10-12').current!
      renderCard(group, {}, { alwaysShowMovements: true })
      expect(screen.getByText(strings.gastos.noPurchases)).toBeInTheDocument()
      expect(screen.getByTestId('home-total')).toHaveTextContent('0,00')
    })
  })

  it('uses the custom title and header action when given', () => {
    renderCard(currentGroup(100), {}, { title: 'Noviembre 2026', headerAction: <button>Cambiar mes</button> })
    expect(screen.getByRole('region', { name: 'Noviembre 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cambiar mes' })).toBeInTheDocument()
  })
})

describe('PeriodCard comparison with the previous month', () => {
  const label = strings.gastos.monthLabel('2026-10')

  it('a running period says how much less (or more) it is than the previous month, like a closed one', () => {
    const { unmount } = renderCard(currentGroup(1500), { '2026-11': 10000 }, { previous: { month: '2026-10', total: 3000 } })
    expect(screen.getByText(strings.home.lessThanPrevious(50, label))).toBeInTheDocument()
    unmount()
    renderCard(currentGroup(4500), { '2026-11': 10000 }, { previous: { month: '2026-10', total: 3000 } })
    expect(screen.getByText(strings.home.moreThanPrevious(50, label))).toBeInTheDocument()
  })

  it('a closed period says it came to more or less than the previous month', () => {
    const views = buildAccountViews([expense({ amount: 150, purchaseDate: new Date('2026-09-20T15:00:00Z') })], data)
    const closed = buildHomePeriods(views, data.cycles, '2026-10-12').closed!
    const { unmount } = renderCard(closed, {}, { previous: { month: '2026-09', total: 100 } })
    expect(screen.getByText(strings.home.moreThanPrevious(50, strings.gastos.monthLabel('2026-09')))).toBeInTheDocument()
    unmount()
    renderCard(closed, {}, { previous: { month: '2026-09', total: 300 } })
    expect(screen.getByText(strings.home.lessThanPrevious(50, strings.gastos.monthLabel('2026-09')))).toBeInTheDocument()
  })

  it('shows no comparison when there is no previous month', () => {
    renderCard(currentGroup(1500), {}, { previous: null })
    expect(screen.queryByText(/Va en el/)).not.toBeInTheDocument()
  })
})
