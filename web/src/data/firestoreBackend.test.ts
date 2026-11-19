import { describe, expect, it } from 'vitest'
import { toFirestore } from './firestoreBackend'

describe('toFirestore', () => {
  it('drops maps that end up empty, at any depth, so a merge cannot wipe their parent', () => {
    expect(toFirestore({ a: { b: {} } })).toEqual({})
    expect(toFirestore({ a: { b: { c: {} } }, n: 1 })).toEqual({ n: 1 })
  })

  it('keeps maps that still change something', () => {
    expect(toFirestore({ a: { b: {}, c: 2 }, d: {} })).toEqual({ a: { c: 2 } })
  })
})
