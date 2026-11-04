// Calendar-date helpers. A calendar date is a plain "YYYY-MM-DD" string with no time zone.

export const TIME_ZONE = 'America/Argentina/Buenos_Aires'

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

const pad = (n: number, width: number) => String(n).padStart(width, '0')

/** True for a real calendar date written exactly `YYYY-MM-DD`. */
export function isValidDateString(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m !== null && isRealDate(Number(m[1]), Number(m[2]), Number(m[3]))
}

/** Parses `dd/mm/yyyy` (one or two digits for day and month) into `YYYY-MM-DD`, or null. */
export function parseDisplayDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim())
  if (!m) return null
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (!isRealDate(year, month, day)) return null
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/** `YYYY-MM-DD` → `dd/mm/yyyy`. */
export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

/** Adds (or subtracts) whole days to a `YYYY-MM-DD` date with calendar arithmetic. */
export function addDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`
}

const dayParts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** The Buenos Aires calendar day of an instant, as `YYYY-MM-DD`. */
export function buenosAiresDay(date: Date): string {
  const parts = Object.fromEntries(dayParts.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** `2026-11-04` as "miércoles 4 de noviembre de 2026" (so a date can be read without guessing dd/mm or mm/dd); '' when invalid. */
export function formatLongDate(value: string): string {
  if (!isValidDateString(value)) return ''
  const [year, month, day] = value.split('-').map(Number)
  const text = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
  return text.charAt(0).toUpperCase() + text.slice(1)
}
