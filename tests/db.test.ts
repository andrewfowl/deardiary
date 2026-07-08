import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { JournalDb } from '../src/main/db'
import { dayStart } from '../src/shared/time'
import type { TimelineCard } from '../src/shared/types'

const DAY = '2026-07-08'
const T0 = dayStart(DAY)

describe('JournalDb', () => {
  let dir: string
  let db: JournalDb

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'deardiary-test-'))
    db = new JournalDb(join(dir, 'test.db'))
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('tracks screenshots through the analysis lifecycle', () => {
    db.insertScreenshot(T0 + 1000, '/tmp/a.jpg')
    db.insertScreenshot(T0 + 2000, '/tmp/b.jpg')
    expect(db.countUnanalyzed()).toBe(2)

    const rows = db.listUnanalyzed(T0 + 5000)
    expect(rows.map((r) => r.path)).toEqual(['/tmp/a.jpg', '/tmp/b.jpg'])

    db.markAnalyzed([rows[0].id])
    expect(db.countUnanalyzed()).toBe(1)
  })

  it('respects the beforeTs cutoff when listing unanalyzed', () => {
    db.insertScreenshot(T0 + 1000, '/tmp/a.jpg')
    db.insertScreenshot(T0 + 9000, '/tmp/b.jpg')
    expect(db.listUnanalyzed(T0 + 5000)).toHaveLength(1)
  })

  it('deletes old screenshots and returns their paths', () => {
    db.insertScreenshot(T0 - 1000, '/tmp/old.jpg')
    db.insertScreenshot(T0 + 1000, '/tmp/new.jpg')
    const removed = db.deleteScreenshotsBefore(T0)
    expect(removed).toEqual(['/tmp/old.jpg'])
    expect(db.countUnanalyzed()).toBe(1)
  })

  it('stores and replaces day cards', () => {
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
    db.replaceDayCards(DAY, cards)
    const loaded = db.getCards(DAY)
    expect(loaded).toHaveLength(1)
    expect(loaded[0].title).toBe('Coding')
    expect(loaded[0].distraction).toBe(false)

    db.replaceDayCards(DAY, [...cards, { ...cards[0], startTs: T0 + 11 * 3_600_000, endTs: T0 + 12 * 3_600_000, title: 'Review', distraction: true }])
    const reloaded = db.getCards(DAY)
    expect(reloaded).toHaveLength(2)
    expect(reloaded[1].distraction).toBe(true)
    expect(db.listDays()).toEqual([DAY])
  })

  it('maps unknown stored categories to "other"', () => {
    db.replaceDayCards(DAY, [
      {
        day: DAY,
        startTs: T0,
        endTs: T0 + 60_000,
        title: 'X',
        summary: '',
        category: 'other',
        distraction: false
      }
    ])
    expect(db.getCards(DAY)[0].category).toBe('other')
  })

  it('upserts daily summaries', () => {
    expect(db.getSummary(DAY)).toBeNull()
    db.setSummary(DAY, 'First version')
    db.setSummary(DAY, 'Second version')
    expect(db.getSummary(DAY)).toBe('Second version')
  })

  it('counts screenshots within a day range', () => {
    db.insertScreenshot(T0 + 1000, '/tmp/a.jpg')
    db.insertScreenshot(T0 - 1000, '/tmp/before.jpg')
    expect(db.countScreenshotsForDay(T0, T0 + 24 * 3_600_000)).toBe(1)
  })
})
