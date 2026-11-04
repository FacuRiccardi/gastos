import { BellRingIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { strings } from '@/strings'
import type { CapAlert } from './capAlertApi'

const s = strings.home.capAlert

// Announces that a spending-cap threshold was passed. Blue on purpose: the red/orange/yellow banners are for missing data.
export function CapAlertBanner({ alert, onDismiss }: { alert: CapAlert; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-400 border-l-8 border-l-sky-600 bg-sky-100 p-3 text-sm text-sky-950 dark:border-sky-800 dark:border-l-sky-500 dark:bg-sky-950/70 dark:text-sky-100"
    >
      <BellRingIcon className="size-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
      <span className="min-w-0 flex-1">{s.message(alert.lastLevel, formatMoney(alert.total, 'ARS'))}</span>
      <Button variant="outline" size="sm" className="bg-background text-foreground" onClick={onDismiss}>
        {s.dismiss}
      </Button>
    </div>
  )
}
