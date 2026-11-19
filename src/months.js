// Month helpers shared with the web app. They must stay identical to web/src/data/months.ts.

const BUENOS_AIRES_OFFSET_MS = -3 * 60 * 60 * 1000;

/** '2026-10-31' -> '2026-10'. */
export function monthOfDay(day) {
  return day.slice(0, 7);
}

// Buenos Aires is UTC-3 all year (no daylight saving), so a fixed shift gives its calendar month.
export function monthOfInstant(date) {
  return new Date(date.getTime() + BUENOS_AIRES_OFFSET_MS).toISOString().slice(0, 7);
}

/** The latest month in `existing` strictly before `target`, or null. */
export function inheritSource(existing, target) {
  let best = null;
  for (const month of existing) {
    if (month < target && (best === null || month > best)) best = month;
  }
  return best;
}
