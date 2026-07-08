import { describe, expect, it } from 'vitest'
import { sampleEvenly } from '../src/shared/analysis/sample'

describe('sampleEvenly', () => {
  it('returns everything when under the limit', () => {
    expect(sampleEvenly([1, 2, 3], 5)).toEqual([1, 2, 3])
  })

  it('keeps first and last items', () => {
    const items = Array.from({ length: 100 }, (_, i) => i)
    const sampled = sampleEvenly(items, 10)
    expect(sampled).toHaveLength(10)
    expect(sampled[0]).toBe(0)
    expect(sampled[sampled.length - 1]).toBe(99)
  })

  it('spreads picks roughly evenly', () => {
    const items = Array.from({ length: 30 }, (_, i) => i)
    const sampled = sampleEvenly(items, 4)
    expect(sampled).toEqual([0, 10, 19, 29])
  })

  it('handles edge limits', () => {
    expect(sampleEvenly([1, 2, 3], 0)).toEqual([])
    expect(sampleEvenly([1, 2, 3], 1)).toEqual([1])
    expect(sampleEvenly([], 5)).toEqual([])
  })
})
