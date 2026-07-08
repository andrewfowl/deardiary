import { describe, expect, it } from 'vitest'
import {
  dayKey,
  dayStart,
  dayEnd,
  shiftDay,
  parseHHMM,
  formatHHMM,
  formatDuration,
  minutesBetween,
  isDayKey
} from '../src/shared/time'

describe('time helpers', () => {
  it('round-trips a day key through dayStart', () => {
    const day = '2026-07-08'
    expect(dayKey(dayStart(day))).toBe(day)
    expect(dayKey(dayEnd(day) - 1)).toBe(day)
    expect(dayKey(dayEnd(day))).toBe('2026-07-09')
  })

  it('validates day keys', () => {
    expect(isDayKey('2026-07-08')).toBe(true)
    expect(isDayKey('2026-7-8')).toBe(false)
    expect(isDayKey('nonsense')).toBe(false)
  })

  it('shifts days across month boundaries', () => {
    expect(shiftDay('2026-07-01', -1)).toBe('2026-06-30')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('parses HH:MM into a timestamp on the day', () => {
    const ts = parseHHMM('2026-07-08', '14:05')
    expect(ts).not.toBeNull()
    expect(formatHHMM(ts!)).toBe('14:05')
    expect(dayKey(ts!)).toBe('2026-07-08')
  })

  it('rejects malformed clock strings', () => {
    expect(parseHHMM('2026-07-08', '25:00')).toBeNull()
    expect(parseHHMM('2026-07-08', '12:65')).toBeNull()
    expect(parseHHMM('2026-07-08', 'afternoon')).toBeNull()
    expect(parseHHMM('2026-07-08', '')).toBeNull()
  })

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(85)).toBe('1h 25m')
    expect(formatDuration(0)).toBe('0m')
  })

  it('computes minutes between timestamps', () => {
    expect(minutesBetween(0, 90_000)).toBe(2)
    expect(minutesBetween(90_000, 0)).toBe(0)
  })
})
