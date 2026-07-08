import { describe, expect, it } from 'vitest'
import { mergeObservations } from '../src/shared/analysis/merge'
import { dayStart } from '../src/shared/time'
import type { Observation, TimelineCard } from '../src/shared/types'

const DAY = '2026-07-08'
const T0 = dayStart(DAY)
const min = (n: number): number => n * 60_000

function obs(startMin: number, endMin: number, partial: Partial<Observation> = {}): Observation {
  return {
    startTs: T0 + min(startMin),
    endTs: T0 + min(endMin),
    title: 'Coding',
    summary: 'Working on the parser.',
    category: 'deep_work',
    distraction: false,
    ...partial
  }
}

describe('mergeObservations', () => {
  it('creates cards from observations on an empty day', () => {
    const cards = mergeObservations(DAY, [], [obs(60, 90), obs(95, 120, { category: 'break', title: 'Coffee' })])
    expect(cards).toHaveLength(2)
    expect(cards[0].title).toBe('Coding')
    expect(cards[1].category).toBe('break')
  })

  it('extends the previous card for same-category observations within the gap', () => {
    const existing = mergeObservations(DAY, [], [obs(60, 90)])
    const cards = mergeObservations(DAY, existing, [obs(92, 120, { summary: 'Added tests.' })])
    expect(cards).toHaveLength(1)
    expect(cards[0].startTs).toBe(T0 + min(60))
    expect(cards[0].endTs).toBe(T0 + min(120))
    expect(cards[0].summary).toContain('Working on the parser.')
    expect(cards[0].summary).toContain('Added tests.')
  })

  it('does not duplicate near-identical summary sentences when extending', () => {
    const existing = mergeObservations(DAY, [], [obs(60, 90)])
    const cards = mergeObservations(DAY, existing, [obs(92, 120)])
    expect(cards[0].summary).toBe('Working on the parser.')
  })

  it('starts a new card when the category changes', () => {
    const existing = mergeObservations(DAY, [], [obs(60, 90)])
    const cards = mergeObservations(DAY, existing, [obs(91, 110, { category: 'meetings', title: 'Standup' })])
    expect(cards).toHaveLength(2)
    expect(cards[1].title).toBe('Standup')
  })

  it('starts a new card when the gap is too large', () => {
    const existing = mergeObservations(DAY, [], [obs(60, 90)])
    const cards = mergeObservations(DAY, existing, [obs(120, 150)])
    expect(cards).toHaveLength(2)
  })

  it('separates distraction from non-distraction even in the same category', () => {
    const cards = mergeObservations(DAY, [], [
      obs(60, 90, { category: 'other' }),
      obs(91, 100, { category: 'other', distraction: true, title: 'YouTube' })
    ])
    expect(cards).toHaveLength(2)
    expect(cards[1].distraction).toBe(true)
  })

  it('clips overlap with already-covered time so re-analysis never duplicates', () => {
    const existing = mergeObservations(DAY, [], [obs(60, 90)])
    const cards = mergeObservations(DAY, existing, [obs(75, 110, { category: 'meetings' })])
    expect(cards).toHaveLength(2)
    expect(cards[1].startTs).toBe(T0 + min(90)) // clipped to end of first card
  })

  it('drops observations fully covered by existing cards', () => {
    const existing = mergeObservations(DAY, [], [obs(60, 120)])
    const cards = mergeObservations(DAY, existing, [obs(70, 80, { category: 'meetings' })])
    expect(cards).toHaveLength(1)
  })

  it('ignores zero/negative-length observations', () => {
    const cards = mergeObservations(DAY, [], [obs(60, 60), obs(90, 80)])
    expect(cards).toHaveLength(0)
  })

  it('clips observations to the day boundaries', () => {
    const cards = mergeObservations(DAY, [], [obs(-30, 30), obs(23 * 60, 25 * 60)])
    expect(cards[0].startTs).toBe(T0)
    expect(cards[1].endTs).toBe(T0 + min(24 * 60))
  })

  it('does not mutate the existing card array', () => {
    const existing: TimelineCard[] = mergeObservations(DAY, [], [obs(60, 90)])
    const before = JSON.stringify(existing)
    mergeObservations(DAY, existing, [obs(92, 120)])
    expect(JSON.stringify(existing)).toBe(before)
  })
})
