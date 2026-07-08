import type { Observation, TimelineCard } from '../types'
import { dayEnd, dayStart } from '../time'

export interface MergeOptions {
  /** Max gap between a card and the next observation for them to merge. */
  gapMs: number
  /** Max total length of a merged card before a new one is forced. */
  maxCardMs: number
}

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  gapMs: 6 * 60_000,
  maxCardMs: 3 * 60 * 60_000
}

/**
 * Merge freshly extracted observations into the existing cards of a day.
 *
 * Deterministic rules:
 *  - observations are clipped to the day and to previously covered time
 *  - an observation extends the previous card when it has the same category
 *    and distraction flag and starts within `gapMs` of the card's end
 *  - otherwise it becomes a new card
 *
 * Returns a fresh, sorted card list for the day.
 */
export function mergeObservations(
  day: string,
  existing: TimelineCard[],
  observations: Observation[],
  options: MergeOptions = DEFAULT_MERGE_OPTIONS
): TimelineCard[] {
  const start = dayStart(day)
  const end = dayEnd(day)

  const cards: TimelineCard[] = existing
    .map((c) => ({ ...c }))
    .sort((a, b) => a.startTs - b.startTs)

  const incoming = observations
    .map((o) => ({
      ...o,
      startTs: Math.max(o.startTs, start),
      endTs: Math.min(o.endTs, end)
    }))
    .filter((o) => o.endTs - o.startTs >= 30_000)
    .sort((a, b) => a.startTs - b.startTs)

  for (const obs of incoming) {
    const last = cards[cards.length - 1]

    // Clip against already-covered time so re-analysis never duplicates.
    const clippedStart = last ? Math.max(obs.startTs, last.endTs) : obs.startTs
    if (obs.endTs - clippedStart < 30_000) continue

    const canExtend =
      last !== undefined &&
      last.category === obs.category &&
      last.distraction === obs.distraction &&
      clippedStart - last.endTs <= options.gapMs &&
      obs.endTs - last.startTs <= options.maxCardMs

    if (canExtend) {
      last.endTs = Math.max(last.endTs, obs.endTs)
      last.summary = appendSummary(last.summary, obs.summary)
    } else {
      cards.push({
        day,
        startTs: clippedStart,
        endTs: obs.endTs,
        title: obs.title,
        summary: obs.summary,
        category: obs.category,
        distraction: obs.distraction
      })
    }
  }

  return cards
}

/** Append a sentence to a card summary, skipping near-duplicates. */
function appendSummary(current: string, added: string): string {
  const a = current.trim()
  const b = added.trim()
  if (!b) return a
  if (!a) return b
  if (normalize(a).includes(normalize(b))) return a
  return `${a} ${b}`
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;!]/g, '')
}
