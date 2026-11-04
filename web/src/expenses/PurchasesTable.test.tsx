import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/expense'
import { strings } from '@/strings'
import { PurchasesTable } from './PurchasesTable'

let n = 0
const expense = (over: Partial<Expense> = {}): Expense => ({
  id: `m${++n}`,
  purchaseDate: new Date('2026-03-15T03:00:00Z'),
  receivedAt: new Date('2026-03-15T18:30:00Z'),
  merchant: `COMERCIO ${n}`,
  amount: 100,
  currency: 'ARS',
  cardLast4: '1234',
  cardType: 'credit',
  cardHolder: 'JUAN',
  status: 'approved',
  ...over,
})

describe('PurchasesTable', () => {
  it('shows the Buenos Aires date, the merchant and the formatted amount', () => {
    render(<PurchasesTable expenses={[expense({ merchant: 'RECARGAS EJEMPLO', amount: 12500 })]} />)
    const row = screen.getByText('RECARGAS EJEMPLO').closest('tr') as HTMLElement
    expect(within(row).getByText('15/03/2026')).toBeInTheDocument()
    expect(row).toHaveTextContent('12.500,00')
  })

  it('shows a Rejected badge only on rejected rows', () => {
    render(
      <PurchasesTable
        expenses={[expense({ merchant: 'APROBADA', amount: 100 }), expense({ merchant: 'RECHAZADA', amount: 0, status: 'rejected' })]}
      />,
    )
    const rejectedRow = screen.getByText('RECHAZADA').closest('tr') as HTMLElement
    const approvedRow = screen.getByText('APROBADA').closest('tr') as HTMLElement
    expect(within(rejectedRow).getByText(strings.expenses.rejected)).toBeInTheDocument()
    expect(within(approvedRow).queryByText(strings.expenses.rejected)).not.toBeInTheDocument()
  })

  it('formats a zero amount', () => {
    render(<PurchasesTable expenses={[expense({ merchant: 'CERO', amount: 0, status: 'rejected' })]} />)
    expect(screen.getByText('CERO').closest('tr')).toHaveTextContent('0,00')
  })
})
