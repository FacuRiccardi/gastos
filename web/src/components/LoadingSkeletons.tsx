import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { strings } from '@/strings'

// The placeholders shown while the data loads. Each one has the shape of the view it stands for, so the
// real content takes its place without the page jumping. The text "Cargando…" stays for screen readers.
export function LoadingRegion({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{strings.loading}</span>
      {children}
    </div>
  )
}

// Rows of a list or table (inside a card that is already open).
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <LoadingRegion>
      <div className="grid gap-2" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </LoadingRegion>
  )
}

// A card with a title, optionally a big number, and some lines.
function CardShape({ big = false, lines = 3 }: { big?: boolean; lines?: number }) {
  return (
    <Card aria-hidden>
      <CardHeader className="grid gap-2">
        <Skeleton className="h-5 w-40" />
        {big && <Skeleton className="h-9 w-52" />}
      </CardHeader>
      <CardContent className="grid gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </CardContent>
    </Card>
  )
}

// A card that is closed: only its title row.
function ClosedCardShape() {
  return (
    <Card aria-hidden>
      <CardHeader className="flex flex-row items-center gap-2">
        <Skeleton className="size-4 shrink-0" />
        <Skeleton className="h-5 w-48" />
      </CardHeader>
    </Card>
  )
}

export function PageSkeleton() {
  return (
    <LoadingRegion>
      <CardShape big />
      <CardShape />
    </LoadingRegion>
  )
}

// Inicio: the card of the period. The alerts have no placeholder: there can be none, or several, and
// they are only known once the data has loaded.
export function HomeSkeleton() {
  return (
    <LoadingRegion>
      <CardShape big lines={4} />
    </LoadingRegion>
  )
}

// Gastos: the card of one period.
export function PeriodSkeleton() {
  return (
    <LoadingRegion>
      <CardShape big lines={5} />
    </LoadingRegion>
  )
}

// Tarjetas: one card per account.
export function CardsSkeleton() {
  return (
    <LoadingRegion>
      <CardShape lines={2} />
      <CardShape lines={2} />
    </LoadingRegion>
  )
}

// Categorías and Presupuesto: a stack of closed cards.
export function ClosedCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion>
      {Array.from({ length: count }, (_, i) => (
        <ClosedCardShape key={i} />
      ))}
    </LoadingRegion>
  )
}

// Balance: the balance card with its four blocks, and the closed card of the history.
export function BalanceSkeleton({ withHistory = true }: { withHistory?: boolean }) {
  return (
    <LoadingRegion>
      <Card aria-hidden>
        <CardHeader className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-8 w-40" />
          </div>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      {withHistory && <ClosedCardShape />}
    </LoadingRegion>
  )
}
