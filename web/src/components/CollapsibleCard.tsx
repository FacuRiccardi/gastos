import { ChevronDownIcon } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTip } from '@/components/ui/tooltip'
import { strings } from '@/strings'

// A card that opens and closes by clicking its title. The explanation that used to be grey text under the
// title goes in `tooltip`, shown by the "i" next to it.
export function CollapsibleCard({
  title,
  tooltip,
  defaultOpen = false,
  children,
}: {
  title: ReactNode
  tooltip?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <Card role="region" aria-labelledby={`${id}-title`}>
      <CardHeader className="flex flex-row items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none max-sm:min-h-11 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDownIcon className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
          <CardTitle id={`${id}-title`}>{title}</CardTitle>
        </button>
        {tooltip && <InfoTip text={tooltip} label={strings.moreInfo} />}
      </CardHeader>
      {open && (
        <CardContent id={`${id}-content`} className="grid gap-4">
          {children}
        </CardContent>
      )}
    </Card>
  )
}
