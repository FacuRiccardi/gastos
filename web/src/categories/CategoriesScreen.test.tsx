import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UncategorizedItem } from '@/data/types'
import type { MerchantsApi } from '@/merchants/merchantsApi'
import { strings } from '@/strings'
import type { CategoriesApi } from './categoriesApi'
import { CategoriesScreen } from './CategoriesScreen'
import type { Category } from './types'

const s = strings.categories

const fakeApi = (): CategoriesApi => ({
  create: vi.fn(async () => 'new'),
  update: vi.fn(async () => {}),
  setArchived: vi.fn(async () => {}),
  setExpenseCategory: vi.fn(async () => {}),
})
const merchantsApi: MerchantsApi = { remember: vi.fn(async () => {}) }

const categories: Category[] = [
  { id: 'food', name: 'Comida', color: '#111111', archived: false },
  { id: 'old', name: 'Vieja', color: '#222222', archived: true },
  { id: 'home', name: 'Hogar', color: '#333333', archived: false },
]
const uncategorized: UncategorizedItem[] = [
  {
    id: 'p1',
    month: '2025-02',
    merchant: 'SUPER',
    amount: 100,
    currency: 'ARS',
    purchaseDate: new Date('2025-02-10T03:00:00Z'),
    cardLast4: '1234',
    cardType: 'credit',
    cardHolder: 'JUAN',
  },
]

function renderScreen(api = fakeApi()) {
  render(
    <CategoriesScreen
      uncategorized={uncategorized}
      categories={categories}
      api={api}
      merchants={[]}
      merchantsApi={merchantsApi}
      onCategorize={vi.fn()}
    />,
  )
  return api
}

async function openCategories() {
  const card = screen.getByRole('region', { name: s.cardTitle })
  await userEvent.click(within(card).getByRole('button', { name: s.cardTitle }))
  return card
}

describe('CategoriesScreen', () => {
  it('counts the uncategorized list in the title', () => {
    renderScreen()
    expect(screen.getByRole('region', { name: `${strings.tabs.toCategorize} (1)` })).toBeInTheDocument()
  })

  it('archiving asks for confirmation and calls setArchived', async () => {
    const api = renderScreen()
    const card = await openCategories()
    await userEvent.click(within(card).getByRole('button', { name: s.archiveAria('Comida') }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(s.archiveTitle('Comida'))
    expect(dialog).toHaveTextContent(s.archiveText)
    expect(api.setArchived).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: s.archive }))
    await waitFor(() => expect(api.setArchived).toHaveBeenCalledWith('food', true))
  })

  it('an archived category can be reactivated', async () => {
    const api = renderScreen()
    const card = await openCategories()
    const rows = within(card).getAllByRole('listitem')
    const last = rows[rows.length - 1]
    expect(last).toHaveTextContent('Vieja')
    expect(last).toHaveTextContent(s.archivedBadge)
    expect(within(last).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(rows[0]).queryByText(s.archivedBadge)).not.toBeInTheDocument()
    await userEvent.click(within(last).getByRole('button', { name: s.unarchiveAria('Vieja') }))
    await waitFor(() => expect(api.setArchived).toHaveBeenCalledWith('old', false))
  })
})
