import type { ReactNode } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

// A titled section that starts closed and opens on click.
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Accordion>
      <AccordionItem value="section" className="border-b-0">
        <AccordionTrigger className="px-2 hover:bg-muted hover:no-underline">
          <h3 className="text-sm font-medium">{title}</h3>
        </AccordionTrigger>
        <AccordionContent className="px-2 pt-2">{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
