import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { strings } from '@/strings'
import { CategoryCharts } from './CategoryCharts'
import type { Slice } from './categoryBreakdown'

const slices: Slice[] = [
  { id: 'food', name: 'Comida', color: '#111111', amount: 7500, percent: 75, top: [{ merchant: 'SUPERMERCADO UNO', amount: 5000 }, { merchant: 'VERDULERIA', amount: 2500 }] },
  { id: 'fun', name: 'Ocio', color: '#222222', amount: 2500, percent: 25, top: [{ merchant: 'CINE', amount: 2500 }] },
]

describe('CategoryCharts', () => {
  it('shows each category with what it came to in pesos and its share', () => {
    render(<CategoryCharts slices={slices} hasForeign={false} />)
    const list = screen.getByRole('list', { name: strings.gastos.barsAria })
    expect(within(list).getByRole('button', { name: /Comida/ })).toHaveTextContent('7.500,00')
    expect(within(list).getByRole('button', { name: /Comida/ })).toHaveTextContent('75,0%')
    expect(within(list).getByRole('button', { name: /Ocio/ })).toHaveTextContent('2.500,00')
  })

  it('tapping a category lists the merchants it is made of, and tapping again hides them', async () => {
    render(<CategoryCharts slices={slices} hasForeign={false} />)
    expect(screen.queryByText('SUPERMERCADO UNO')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Comida/ }))
    const merchants = screen.getByRole('list', { name: strings.gastos.merchantsAria('Comida') })
    expect(within(merchants).getByText('SUPERMERCADO UNO')).toBeInTheDocument()
    expect(within(merchants).getByText('VERDULERIA')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Comida/ }))
    expect(screen.queryByText('SUPERMERCADO UNO')).not.toBeInTheDocument()
  })

  it('has no pie chart: the bars are the only chart', () => {
    render(<CategoryCharts slices={slices} hasForeign={false} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('says there is nothing to show without slices', () => {
    render(<CategoryCharts slices={[]} hasForeign={false} />)
    expect(screen.getByText(strings.gastos.noChartData)).toBeInTheDocument()
  })
})
