import type { Observation, TimelineCard, ChatMessage } from '../types'
import { CATEGORIES, isValidCategory } from '../categories'
import { formatHHMM, formatDuration, minutesBetween, parseHHMM } from '../time'

/** JSON schema for the observation-extraction response (Anthropic structured outputs). */
export const OBSERVATIONS_SCHEMA = {
  type: 'object',
  properties: {
    observations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startTime: { type: 'string', description: '24h clock time like "14:05"' },
          endTime: { type: 'string', description: '24h clock time like "14:30"' },
          title: { type: 'string', description: 'Short human title, max ~8 words' },
          summary: {
            type: 'string',
            description: 'One or two sentences describing what the person was doing'
          },
          category: {
            type: 'string',
            enum: CATEGORIES.map((c) => c.id)
          },
          distraction: {
            type: 'boolean',
            description: 'True if this looked like off-task leisure rather than work'
          }
        },
        required: ['startTime', 'endTime', 'title', 'summary', 'category', 'distraction'],
        additionalProperties: false
      }
    }
  },
  required: ['observations'],
  additionalProperties: false
} as const

const CATEGORY_GUIDE = CATEGORIES.map((c) => `- ${c.id}: ${c.label}`).join('\n')

/**
 * Prompt for turning a batch of timestamped screenshots into activity
 * observations. Screenshots are attached in order; each frame's capture time
 * is listed here so the model can produce real clock-time segments.
 */
export function buildAnalysisPrompt(frameTimes: number[]): string {
  const frames = frameTimes.map((ts, i) => `Frame ${i + 1}: ${formatHHMM(ts)}`).join('\n')
  return `You are analyzing periodic screenshots of one person's computer screen to build an automatic work journal. The screenshots are attached in chronological order and were captured at these local times:

${frames}

Segment this period into continuous activities. For each activity return:
- startTime / endTime: 24h clock times ("HH:MM") covering the frames that belong to it. Segments must be in order and should cover the whole captured period without overlapping.
- title: short and specific ("Editing billing service in VS Code", not "Working").
- summary: 1-2 sentences with concrete details visible on screen (project names, document titles, sites) so the person can recall this moment later.
- category: one of:
${CATEGORY_GUIDE}
- distraction: true only when the activity is clearly off-task leisure (entertainment, social feeds, shopping). Work-related videos or reading are NOT distractions.

Prefer fewer, longer segments over many tiny ones; merge adjacent frames showing the same activity. Never invent things not visible in the screenshots.

Respond with JSON only, in this exact shape:
{"observations": [{"startTime": "14:05", "endTime": "14:30", "title": "...", "summary": "...", "category": "deep_work", "distraction": false}]}`
}

interface RawObservation {
  startTime?: unknown
  endTime?: unknown
  title?: unknown
  summary?: unknown
  category?: unknown
  distraction?: unknown
}

/**
 * Parse and validate a model response into Observations for the given day.
 * Tolerates code fences, a bare array, and end times that roll past midnight.
 * Invalid entries are dropped rather than failing the whole batch.
 */
export function parseObservations(responseText: string, day: string): Observation[] {
  const text = stripCodeFences(responseText)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const list: unknown = Array.isArray(parsed)
    ? parsed
    : (parsed as { observations?: unknown })?.observations
  if (!Array.isArray(list)) return []

  const out: Observation[] = []
  for (const raw of list as RawObservation[]) {
    if (typeof raw !== 'object' || raw === null) continue
    const startTs = typeof raw.startTime === 'string' ? parseHHMM(day, raw.startTime) : null
    let endTs = typeof raw.endTime === 'string' ? parseHHMM(day, raw.endTime) : null
    if (startTs === null || endTs === null) continue
    if (endTs <= startTs) endTs += 24 * 60 * 60_000 // crossed midnight
    const title = typeof raw.title === 'string' ? raw.title.trim() : ''
    if (!title) continue
    const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
    const category =
      typeof raw.category === 'string' && isValidCategory(raw.category) ? raw.category : 'other'
    out.push({
      startTs,
      endTs,
      title,
      summary,
      category,
      distraction: raw.distraction === true
    })
  }
  return out.sort((a, b) => a.startTs - b.startTs)
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m.exec(trimmed)
  return fence ? fence[1] : trimmed
}

/** Render a day's cards as plain text context for summary/chat prompts. */
export function renderCardsForPrompt(cards: TimelineCard[]): string {
  if (cards.length === 0) return '(no recorded activity)'
  return cards
    .map((c) => {
      const dur = formatDuration(minutesBetween(c.startTs, c.endTs))
      const flag = c.distraction ? ' [distraction]' : ''
      return `${formatHHMM(c.startTs)}-${formatHHMM(c.endTs)} (${dur}) [${c.category}]${flag} ${c.title} — ${c.summary}`
    })
    .join('\n')
}

export function buildSummaryPrompt(day: string, cards: TimelineCard[]): string {
  return `Here is the recorded activity timeline for ${day}:

${renderCardsForPrompt(cards)}

Write a daily work journal entry for this person. Structure:
1. A 2-3 sentence narrative of how the day went.
2. "Highlights:" — 3-5 bullet points of concrete accomplishments.
3. If there was meaningful distraction time, one honest, non-judgmental sentence about it.

Write in second person ("You spent the morning..."). Be specific — use the project and document names from the timeline. Do not invent anything not present in the timeline.`
}

export function buildChatSystemPrompt(day: string, cards: TimelineCard[], summary: string | null): string {
  return `You are DearDiary, an assistant that helps a person recall and reflect on their recorded workday. You answer questions using ONLY the activity timeline below. If the answer is not in the timeline, say you don't have a record of it.

Date: ${day}

Timeline:
${renderCardsForPrompt(cards)}
${summary ? `\nDaily summary:\n${summary}` : ''}

Answer concisely and reference clock times when useful.`
}

export function chatHistoryToPrompt(history: ChatMessage[], question: string): string {
  const past = history
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n')
  return past ? `${past}\nUser: ${question}` : question
}

export function buildStandupPolishPrompt(draft: string, cards: TimelineCard[]): string {
  return `Here is an auto-generated standup draft and the underlying activity timeline.

Draft:
${draft}

Timeline:
${renderCardsForPrompt(cards)}

Rewrite the draft as a crisp standup update a software professional would post in Slack: short bullets, outcome-oriented wording, no filler, no durations unless notable. Keep the Yesterday / Today / Blockers structure. Return only the update text.`
}
