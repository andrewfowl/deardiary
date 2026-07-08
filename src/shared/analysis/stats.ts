import type { Category, DayStats, TimelineCard } from '../types'
import { categoryInfo } from '../categories'
import { minutesBetween } from '../time'

const FOCUS_CHAIN_GAP_MS = 6 * 60_000

/** Aggregate a day's cards into headline numbers for the Journal view. */
export function computeDayStats(cards: TimelineCard[]): DayStats {
  const byCategory: Partial<Record<Category, number>> = {}
  let totalMinutes = 0
  let focusMinutes = 0
  let distractionMinutes = 0

  const sorted = [...cards].sort((a, b) => a.startTs - b.startTs)

  for (const card of sorted) {
    const minutes = minutesBetween(card.startTs, card.endTs)
    totalMinutes += minutes
    byCategory[card.category] = (byCategory[card.category] ?? 0) + minutes
    if (categoryInfo(card.category).focus && !card.distraction) focusMinutes += minutes
    if (card.distraction || card.category === 'distraction') distractionMinutes += minutes
  }

  // Longest uninterrupted stretch of focus-category cards (small gaps allowed).
  let longest = 0
  let chainStart: number | null = null
  let chainEnd = 0
  for (const card of sorted) {
    const isFocus = categoryInfo(card.category).focus && !card.distraction
    if (!isFocus) {
      chainStart = null
      continue
    }
    if (chainStart !== null && card.startTs - chainEnd <= FOCUS_CHAIN_GAP_MS) {
      chainEnd = Math.max(chainEnd, card.endTs)
    } else {
      chainStart = card.startTs
      chainEnd = card.endTs
    }
    longest = Math.max(longest, minutesBetween(chainStart, chainEnd))
  }

  return {
    totalMinutes,
    focusMinutes,
    distractionMinutes,
    longestFocusMinutes: longest,
    byCategory
  }
}
