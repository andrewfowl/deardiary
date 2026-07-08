import { describe, expect, it } from 'vitest'
import { computeDayStats } from '../src/shared/analysis/stats'
import { dayStart } from '../src/shared/time'
import type { TimelineCard } from '../src/shared/types'

const DAY = '2026-07-08'
const T0 = dayStart(DAY)
const min = (n: number): number => n * 60_000

function card(startMin: number, endMin: number, partial: Partial<TimelineCard> = {}): TimelineCard {
  return {
    day: DAY,
    startTs: T0 + min(startMin),
    endTs: T0 + min(endMin),
    title: 'Work',
    summary: '',
    category: 'deep_work',
    distraction: false,
    ...partial
  }
}

describe('computeDayStats', () => {
  it('returns zeros for an empty day', () => {
    const stats = computeDayStats([])
    expect(stats.totalMinutes).toBe(0)
    expect(stats.focusMinutes).toBe(0)
    expect(stats.longestFocusMinutes).toBe(0)
  })

  it('aggregates totals per category', () => {
    const stats = computeDayStats([
      card(540, 600), // 60m deep work
      card(600, 630, { category: 'meetings' }),
      card(630, 645, { category: 'distraction', distraction: true })
    ])
    expect(stats.totalMinutes).toBe(105)
    expect(stats.byCategory.deep_work).toBe(60)
    expect(stats.byCategory.meetings).toBe(30)
    expect(stats.focusMinutes).toBe(60)
    expect(stats.distractionMinutes).toBe(15)
  })

  it('chains focus cards across small gaps for the longest streak', () => {
    const stats = computeDayStats([
      card(540, 600),
      card(604, 660, { category: 'research' }), // 4m gap → same streak
      card(700, 720) // big gap → new streak
    ])
    expect(stats.longestFocusMinutes).toBe(120)
  })

  it('breaks the focus streak on non-focus cards', () => {
    const stats = computeDayStats([
      card(540, 600),
      card(600, 615, { category: 'meetings' }),
      card(615, 640)
    ])
    expect(stats.longestFocusMinutes).toBe(60)
  })
})
