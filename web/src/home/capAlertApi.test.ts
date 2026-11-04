import { describe, expect, it } from 'vitest'
import { visibleCapAlert, type CapAlert } from './capAlertApi'

const alert: CapAlert = { month: '2026-11', lastLevel: 50, total: 500, cap: 1000 }

describe('visibleCapAlert', () => {
  it('shows the alert when it was not dismissed', () => {
    expect(visibleCapAlert(alert, null)).toBe(alert)
  })
  it('hides it when the dismissed level is the same', () => {
    expect(visibleCapAlert(alert, 50)).toBeNull()
  })
  it('shows it again when the level went up after the dismissal', () => {
    const higher = { ...alert, lastLevel: 75 }
    expect(visibleCapAlert(higher, 50)).toBe(higher)
  })
  it('returns null when there is no alert', () => {
    expect(visibleCapAlert(null, null)).toBeNull()
    expect(visibleCapAlert(null, 50)).toBeNull()
  })
})
