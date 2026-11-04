import { useState } from 'react'
import { InfoTip } from '@/components/ui/tooltip'
import { formatMoney } from '@/lib/format'
import { strings } from '@/strings'
import { formatPercent, type Slice } from './categoryBreakdown'

// Horizontal bars, one row per category: its name, what it came to in pesos and its share. The longest bar is the
// biggest category (so the differences read clearly); tapping a row shows the merchants it is made of.
function BarChart({ slices }: { slices: Slice[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const biggest = Math.max(...slices.map((s) => s.percent), 1)
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-1" aria-label={strings.gastos.barsAria}>
      {slices.map((s) => {
        const expanded = open === s.id
        return (
          <li key={s.id} className="min-w-0">
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={strings.gastos.categoryRowAria(s.name, formatMoney(s.amount, 'ARS'), formatPercent(s.percent))}
              onClick={() => setOpen(expanded ? null : s.id)}
              className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)] gap-1 rounded-md px-1 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatMoney(s.amount, 'ARS')} <span className="text-muted-foreground">· {formatPercent(s.percent)}</span>
                </span>
              </span>
              <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full" style={{ width: `${Math.max((s.percent / biggest) * 100, 1.5)}%`, backgroundColor: s.color }} />
              </span>
            </button>
            {expanded && (
              <ul className="mb-2 ml-5 grid grid-cols-[minmax(0,1fr)] gap-1 border-l pl-3 text-sm text-muted-foreground" aria-label={strings.gastos.merchantsAria(s.name)}>
                {s.top.map((m) => (
                  <li key={m.merchant} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{m.merchant}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(m.amount, 'ARS')}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function CategoryCharts({ slices, hasForeign }: { slices: Slice[]; hasForeign: boolean }) {
  if (slices.length === 0) return <p className="text-sm text-muted-foreground">{strings.gastos.noChartData}</p>
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
      <h4 className="flex items-center gap-1 text-sm font-medium">
        {strings.gastos.byCategory}
        {hasForeign && <InfoTip text={strings.gastos.foreignNote} label={strings.moreInfo} />}
      </h4>
      <BarChart slices={slices} />
      <p className="text-xs text-muted-foreground">{strings.gastos.tapForDetail}</p>
    </div>
  )
}
