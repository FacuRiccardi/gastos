import type { Category } from '@/categories/types'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { strings } from '@/strings'
import { PurchasesTable } from './PurchasesTable'
import type { TabView } from './statements'
import { formatTotals } from './formatTotals'

// The credit cards of a period, each one a row that opens to its purchases. Shared by Gastos and Inicio.
export function CardsAccordion({
  tab,
  categories,
  onCategoryChange,
}: {
  tab: TabView
  categories?: Category[]
  onCategoryChange?: (expenseId: string, categoryId: string | null) => void
}) {
  return (
  <Accordion multiple>
    {tab.cards.map((c) => {
      const key = `${c.card.last4}_${c.card.type}`
      if (c.count === 0) {
        // Nothing to expand: a plain row, no toggle.
        return (
          <div key={key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-2 py-2.5 text-sm relative not-last:after:absolute not-last:after:inset-x-3 not-last:after:bottom-0 not-last:after:h-px not-last:after:bg-border">
            <span className="font-semibold">{c.card.holder}</span>
            <span className="text-muted-foreground">
              <span className="hidden sm:inline">{strings.expenses.cardType[c.card.type]} </span>
              {c.card.last4}
            </span>
            <span className="ml-auto text-muted-foreground">{strings.gastos.noPurchases}</span>
          </div>
        )
      }
      return (
        <AccordionItem key={key} value={key} className="not-last:border-b-0 relative not-last:after:absolute not-last:after:inset-x-3 not-last:after:bottom-0 not-last:after:h-px not-last:after:bg-border">
          <AccordionTrigger className="px-2 hover:bg-muted hover:no-underline">
            <span className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold">{c.card.holder}</span>
              <span className="text-muted-foreground">
                <span className="hidden sm:inline">{strings.expenses.cardType[c.card.type]} </span>
                {c.card.last4}
              </span>
              {c.count > 0 && (
                <span className="hidden text-muted-foreground sm:inline">{strings.expenses.purchases(c.count)}</span>
              )}
              <span className="ml-auto font-medium tabular-nums">
                {c.count === 0 ? strings.gastos.noPurchases : formatTotals(c.totals)}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>{c.count > 0 && <PurchasesTable expenses={c.expenses} categories={categories} onCategoryChange={onCategoryChange} />}</AccordionContent>
        </AccordionItem>
      )
    })}
  </Accordion>
  )
}
