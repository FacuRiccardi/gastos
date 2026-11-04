import { describe, expect, it } from 'vitest'
import { merchantKey } from './merchantKey'

// The same table is checked against the backend twin (src/merchant.js) in test/merchantKey.twin.test.js.
describe('merchantKey', () => {
  it.each([
    ['Spotify P47A11CB7B', 'spotify'],
    ['RECARGAS EJEMPLO', 'recargas-ejemplo'],
    ['Café Martínez', 'cafe-martinez'],
    ['CAFÉ  MARTÍNEZ', 'cafe-martinez'],
    ['  Kiosco   24 Horas ', 'kiosco-horas'],
    ['MERCADO*PAGO-ejemplo', 'mercado-pago-ejemplo'],
    ['Farmacia & Perfumería', 'farmacia-perfumeria'],
    ['Ñandú Ñoño', 'nandu-nono'],
    ['12345 678', ''],
    ['', ''],
    ['   ', ''],
    ['***', ''],
    ['Super 3B Norte', 'super-norte'],
  ])('%j -> %j', (name, key) => {
    expect(merchantKey(name)).toBe(key)
  })

  it('cuts the key at 100 characters', () => {
    expect(merchantKey('a'.repeat(150))).toHaveLength(100)
  })
})
