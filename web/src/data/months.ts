// Month helpers shared with the ingestion service. They must stay identical to src/months.js.

const BUENOS_AIRES_OFFSET_MS = -3 * 60 * 60 * 1000

/** '2026-10-31' -> '2026-10'. */
export function monthOfDay(day: string): string {
  return day.slice(0, 7)
}

// Buenos Aires is UTC-3 all year (no daylight saving), so a fixed shift gives its calendar month.
export function monthOfInstant(date: Date): string {
  return new Date(date.getTime() + BUENOS_AIRES_OFFSET_MS).toISOString().slice(0, 7)
}

/** The latest month in `existing` strictly before `target`, or null. */
export function inheritSource(existing: string[], target: string): string | null {
  let best: string | null = null
  for (const month of existing) {
    if (month < target && (best === null || month > best)) best = month
  }
  return best
}
