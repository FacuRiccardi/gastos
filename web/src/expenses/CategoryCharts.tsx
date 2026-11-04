import { useState } from 'react'
import { formatPercent, type Slice } from './categoryBreakdown'
import { InfoTip } from '@/components/ui/tooltip'
import { strings } from '@/strings'

// Horizontal bars: one row per slice, the bar length is its share of the total.
function BarChart({ slices }: { slices: Slice[] }) {
  return (
    <ul className="grid gap-2" aria-label={strings.gastos.barsAria}>
      {slices.map((s) => (
        <li key={s.id} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 truncate">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate">{s.name}</span>
          </span>
          <span className="h-3 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(s.percent, 0.5)}%`, backgroundColor: s.color }} />
          </span>
          <span className="text-right tabular-nums text-muted-foreground">{formatPercent(s.percent)}</span>
        </li>
      ))}
    </ul>
  )
}

const point = (fraction: number) => [Math.cos(2 * Math.PI * fraction - Math.PI / 2), Math.sin(2 * Math.PI * fraction - Math.PI / 2)]

// Pie drawn with SVG paths. Each slice carries its name and share inside; slices too narrow for the
// name show only the share, and the tiniest ones nothing. Hovering (or tapping) a slice always shows
// its full name and share in the middle of the pie. The hidden list is for screen readers.
function PieChart({ slices }: { slices: Slice[] }) {
  let start = 0
  const FONT = 0.075
  const [active, setActive] = useState<string | null>(null)
  return (
    <div>
      <svg viewBox="-1 -1 2 2" role="img" aria-label={strings.gastos.pieAria} className="mx-auto w-full max-w-md">
        {slices.length === 1 ? (
          <circle r="1" fill={slices[0].color} />
        ) : (
          slices.map((s) => {
            const from = start
            start += s.percent / 100
            const [x1, y1] = point(from)
            const [x2, y2] = point(start)
            const large = s.percent > 50 ? 1 : 0
            return (
              <path
                key={s.id}
                d={`M 0 0 L ${x1} ${y1} A 1 1 0 ${large} 1 ${x2} ${y2} Z`}
                fill={s.color}
                opacity={active && active !== s.id ? 0.55 : 1}
                stroke="var(--background)"
                strokeWidth="0.01"
                className="cursor-pointer"
                onMouseEnter={() => setActive(s.id)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive((a) => (a === s.id ? null : s.id))}
              />
            )
          })
        )}
        {(() => {
          let acc = 0
          return slices.map((s) => {
            const mid = acc + s.percent / 200
            acc += s.percent / 100
            const [cx, cy] = slices.length === 1 ? [0, 0] : point(mid).map((v) => v * 0.64)
            // Room along the arc at that radius, in characters.
            const chars = Math.floor((2 * Math.PI * 0.64 * (s.percent / 100)) / (FONT * 0.55))
            const showName = slices.length === 1 || chars >= 5
            const showPercent = slices.length === 1 || s.percent >= 3
            if (!showPercent) return null
            const name = chars >= s.name.length || slices.length === 1 ? s.name : `${s.name.slice(0, Math.max(chars - 1, 1))}…`
            return (
              <text
                key={s.id}
                x={cx}
                y={cy}
                textAnchor="middle"
                fontSize={FONT}
                fontWeight={600}
                fill="white"
                stroke="rgba(0,0,0,0.55)"
                strokeWidth={0.018}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {showName && <tspan x={cx} dy={-FONT * 0.15}>{name}</tspan>}
                <tspan x={cx} dy={showName ? FONT * 1.2 : FONT * 0.35}>{formatPercent(s.percent)}</tspan>
              </text>
            )
          })
        })()}
        {(() => {
          const hovered = slices.find((x) => x.id === active)
          if (!hovered || slices.length === 1) return null
          return (
            <text
              textAnchor="middle"
              fontSize={FONT * 1.25}
              fontWeight={700}
              fill="white"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={0.03}
              paintOrder="stroke"
              pointerEvents="none"
            >
              <tspan x={0} dy={-FONT * 0.2}>{hovered.name}</tspan>
              <tspan x={0} dy={FONT * 1.5}>{formatPercent(hovered.percent)}</tspan>
            </text>
          )
        })()}
      </svg>
      <ul className="sr-only">
        {slices.map((s) => (
          <li key={s.id}>
            {s.name}: {formatPercent(s.percent)}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CategoryCharts({ slices, hasForeign }: { slices: Slice[]; hasForeign: boolean }) {
  if (slices.length === 0) return <p className="text-sm text-muted-foreground">{strings.gastos.noChartData}</p>
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <h4 className="flex items-center gap-1 text-sm font-medium">
          {strings.gastos.byCategory}
          {hasForeign && <InfoTip text={strings.gastos.foreignNote} label={strings.moreInfo} />}
        </h4>
        <BarChart slices={slices} />
      </div>
      <PieChart slices={slices} />
    </div>
  )
}
