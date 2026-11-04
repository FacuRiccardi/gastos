import { TIME_ZONE } from './dates'

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

// e.g. formatMoney(12500, 'ARS') -> "$ 12.500,00"
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

// Always displays the Buenos Aires day, whatever time zone the browser is in.
export function formatDate(date: Date): string {
  return dateFormat.format(date)
}
