import type { TimelineCard } from '../types'
import { formatDuration, minutesBetween } from '../time'

const MAX_ITEMS = 6
const MIN_MINUTES = 10

/**
 * Deterministic standup draft from recorded cards: activities are grouped by
 * title, breaks/distractions are dropped, and the biggest time sinks win.
 */
export function buildStandup(yesterday: TimelineCard[], today: TimelineCard[]): string {
  const sections = [
    `**Yesterday**\n${renderSection(yesterday)}`,
    `**Today**\n${renderSection(today)}`,
    `**Blockers**\n- None noted`
  ]
  return sections.join('\n\n')
}

function renderSection(cards: TimelineCard[]): string {
  const items = aggregate(cards)
  if (items.length === 0) return '- No recorded activity'
  return items
    .map((item) => `- ${item.title} (${formatDuration(item.minutes)})`)
    .join('\n')
}

interface AggregatedItem {
  title: string
  minutes: number
}

export function aggregate(cards: TimelineCard[]): AggregatedItem[] {
  const byTitle = new Map<string, AggregatedItem>()
  for (const card of cards) {
    if (card.distraction || card.category === 'distraction' || card.category === 'break') continue
    const minutes = minutesBetween(card.startTs, card.endTs)
    const key = card.title.trim().toLowerCase()
    const existing = byTitle.get(key)
    if (existing) existing.minutes += minutes
    else byTitle.set(key, { title: card.title.trim(), minutes })
  }
  return [...byTitle.values()]
    .filter((i) => i.minutes >= MIN_MINUTES)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, MAX_ITEMS)
}
