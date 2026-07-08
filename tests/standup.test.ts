import { describe, expect, it } from 'vitest'
import { aggregate, buildStandup } from '../src/shared/analysis/standup'
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
    title: 'Refactoring billing service',
    summary: '',
    category: 'deep_work',
    distraction: false,
    ...partial
  }
}

describe('aggregate', () => {
  it('groups cards by title and sums durations', () => {
    const items = aggregate([card(540, 600), card(700, 730)])
    expect(items).toHaveLength(1)
    expect(items[0].minutes).toBe(90)
  })

  it('excludes breaks and distractions', () => {
    const items = aggregate([
      card(540, 600),
      card(600, 630, { category: 'break', title: 'Lunch' }),
      card(630, 700, { distraction: true, title: 'YouTube' })
    ])
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Refactoring billing service')
  })

  it('drops tiny items and sorts by duration', () => {
    const items = aggregate([
      card(540, 545, { title: 'Quick glance' }), // 5m — below threshold
      card(560, 590, { title: 'Code review' }),
      card(600, 700, { title: 'Feature work' })
    ])
    expect(items.map((i) => i.title)).toEqual(['Feature work', 'Code review'])
  })
})

describe('buildStandup', () => {
  it('renders yesterday/today/blockers sections', () => {
    const text = buildStandup([card(540, 600)], [card(560, 620, { title: 'Writing tests' })])
    expect(text).toContain('**Yesterday**')
    expect(text).toContain('Refactoring billing service (1h)')
    expect(text).toContain('**Today**')
    expect(text).toContain('Writing tests (1h)')
    expect(text).toContain('**Blockers**')
  })

  it('handles days with no activity', () => {
    const text = buildStandup([], [])
    expect(text).toContain('- No recorded activity')
  })
})
