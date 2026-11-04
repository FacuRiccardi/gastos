import { describe, expect, it } from 'vitest'
import { merchantLabel } from './merchantLabel'

describe('merchantLabel', () => {
  it('drops the amounts and codes that statements append to a name', () => {
    expect(merchantLabel('DB.RG 5617 30% ( 36252,42 )')).toBe('DB.RG')
    expect(merchantLabel('Spotify P47A11CB7B')).toBe('Spotify')
    expect(merchantLabel('AFIP VEP 1700250136 20413')).toBe('AFIP VEP')
  })

  it('keeps ordinary names as they are', () => {
    expect(merchantLabel('MERPAGO*DIA')).toBe('MERPAGO*DIA')
    expect(merchantLabel('TODO TARTAS SUCURSAL M')).toBe('TODO TARTAS SUCURSAL M')
  })

  it('falls back to the name when it is only codes', () => {
    expect(merchantLabel(' 12345 ')).toBe('12345')
  })
})
