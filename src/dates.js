// Calendar-date helpers. A calendar date is a plain "YYYY-MM-DD" string with no time zone.
// Mirrors web/src/lib/dates.ts.

export const TIME_ZONE = 'America/Argentina/Buenos_Aires';

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The Buenos Aires calendar day (`YYYY-MM-DD`) of an instant. */
export function buenosAiresDay(date) {
  return formatter.format(date);
}

/** Adds (or subtracts) whole days to a `YYYY-MM-DD` date with calendar arithmetic. */
export function addDays(day, days) {
  const [year, month, d] = day.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, d + days));
  const pad = (n, width) => String(n).padStart(width, '0');
  return `${pad(result.getUTCFullYear(), 4)}-${pad(result.getUTCMonth() + 1, 2)}-${pad(result.getUTCDate(), 2)}`;
}
