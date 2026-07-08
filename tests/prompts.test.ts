import { describe, expect, it } from 'vitest'
import {
  buildAnalysisPrompt,
  parseObservations,
  renderCardsForPrompt
} from '../src/shared/analysis/prompts'
import { dayStart, formatHHMM } from '../src/shared/time'
import type { TimelineCard } from '../src/shared/types'

const DAY = '2026-07-08'
const T0 = dayStart(DAY)

describe('buildAnalysisPrompt', () => {
  it('lists frame times in order', () => {
    const times = [T0 + 9 * 3_600_000, T0 + 9 * 3_600_000 + 60_000]
    const prompt = buildAnalysisPrompt(times)
    expect(prompt).toContain(`Frame 1: ${formatHHMM(times[0])}`)
    expect(prompt).toContain(`Frame 2: ${formatHHMM(times[1])}`)
    expect(prompt).toContain('"observations"')
  })
})

describe('parseObservations', () => {
  const valid = JSON.stringify({
    observations: [
      {
        startTime: '09:00',
        endTime: '09:30',
        title: 'Editing report',
        summary: 'Writing the Q3 report in Word.',
        category: 'deep_work',
        distraction: false
      }
    ]
  })

  it('parses a valid response', () => {
    const obs = parseObservations(valid, DAY)
    expect(obs).toHaveLength(1)
    expect(obs[0].title).toBe('Editing report')
    expect(formatHHMM(obs[0].startTs)).toBe('09:00')
    expect(formatHHMM(obs[0].endTs)).toBe('09:30')
  })

  it('tolerates markdown code fences', () => {
    const obs = parseObservations('```json\n' + valid + '\n```', DAY)
    expect(obs).toHaveLength(1)
  })

  it('accepts a bare array', () => {
    const arr = JSON.stringify([
      {
        startTime: '10:00',
        endTime: '10:15',
        title: 'Email',
        summary: 'Inbox triage.',
        category: 'communication',
        distraction: false
      }
    ])
    expect(parseObservations(arr, DAY)).toHaveLength(1)
  })

  it('falls back to "other" for unknown categories', () => {
    const text = JSON.stringify({
      observations: [
        {
          startTime: '10:00',
          endTime: '10:15',
          title: 'Mystery',
          summary: 'Unknown.',
          category: 'gaming',
          distraction: true
        }
      ]
    })
    const obs = parseObservations(text, DAY)
    expect(obs[0].category).toBe('other')
    expect(obs[0].distraction).toBe(true)
  })

  it('drops entries with malformed times or missing titles', () => {
    const text = JSON.stringify({
      observations: [
        { startTime: 'morning', endTime: '10:00', title: 'Bad', summary: '', category: 'other' },
        { startTime: '10:00', endTime: '10:30', title: '', summary: '', category: 'other' },
        { startTime: '11:00', endTime: '11:30', title: 'Good', summary: '', category: 'other' }
      ]
    })
    const obs = parseObservations(text, DAY)
    expect(obs).toHaveLength(1)
    expect(obs[0].title).toBe('Good')
  })

  it('rolls end times past midnight forward', () => {
    const text = JSON.stringify({
      observations: [
        {
          startTime: '23:50',
          endTime: '00:10',
          title: 'Late night',
          summary: '',
          category: 'other',
          distraction: false
        }
      ]
    })
    const obs = parseObservations(text, DAY)
    expect(obs[0].endTs).toBeGreaterThan(obs[0].startTs)
    expect(obs[0].endTs - obs[0].startTs).toBe(20 * 60_000)
  })

  it('returns empty for garbage input', () => {
    expect(parseObservations('not json at all', DAY)).toHaveLength(0)
    expect(parseObservations('{"observations": "nope"}', DAY)).toHaveLength(0)
  })
})

describe('renderCardsForPrompt', () => {
  it('renders cards with times, categories and flags', () => {
    const cards: TimelineCard[] = [
      {
        day: DAY,
        startTs: T0 + 9 * 3_600_000,
        endTs: T0 + 10 * 3_600_000,
        title: 'Coding',
        summary: 'Parser work.',
        category: 'deep_work',
        distraction: false
      }
    ]
    const text = renderCardsForPrompt(cards)
    expect(text).toContain('09:00-10:00')
    expect(text).toContain('[deep_work]')
    expect(text).toContain('Coding — Parser work.')
  })

  it('handles empty days', () => {
    expect(renderCardsForPrompt([])).toContain('no recorded activity')
  })
})
