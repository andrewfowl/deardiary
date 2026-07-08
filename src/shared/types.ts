/**
 * Types shared between the main process, preload bridge, and renderer.
 */

export type Category =
  | 'deep_work'
  | 'communication'
  | 'meetings'
  | 'research'
  | 'admin'
  | 'break'
  | 'distraction'
  | 'other'

/** A single AI-extracted activity segment from one analysis batch. */
export interface Observation {
  startTs: number
  endTs: number
  title: string
  summary: string
  category: Category
  distraction: boolean
}

/** A merged block on the day timeline (what the user sees). */
export interface TimelineCard {
  id?: number
  day: string // YYYY-MM-DD (local)
  startTs: number
  endTs: number
  title: string
  summary: string
  category: Category
  distraction: boolean
}

export interface DayStats {
  totalMinutes: number
  focusMinutes: number
  distractionMinutes: number
  longestFocusMinutes: number
  byCategory: Partial<Record<Category, number>>
}

export interface DayData {
  day: string
  cards: TimelineCard[]
  summary: string | null
  stats: DayStats
  screenshotCount: number
}

export type ProviderId = 'gemini' | 'anthropic' | 'openai' | 'ollama'

export interface Settings {
  provider: ProviderId
  geminiApiKey: string
  geminiModel: string
  anthropicApiKey: string
  anthropicModel: string
  openaiApiKey: string
  openaiBaseUrl: string
  openaiModel: string
  ollamaBaseUrl: string
  ollamaModel: string
  /** Seconds between screenshots. */
  captureIntervalSec: number
  /** Minutes of screenshots to accumulate before running an AI analysis batch. */
  batchMinutes: number
  /** Seconds of no input before capture is skipped as "idle". */
  idleThresholdSec: number
  /** Days to keep raw screenshots on disk (journal data is kept forever). */
  retentionDays: number
  /** Capture every display instead of just the primary one. */
  captureAllScreens: boolean
  /** Recording paused by the user. */
  paused: boolean
}

export interface CaptureStatus {
  recording: boolean
  paused: boolean
  locked: boolean
  idle: boolean
  lastCaptureTs: number | null
  pendingScreenshots: number
  lastBatchTs: number | null
  analyzing: boolean
  lastError: string | null
  providerConfigured: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

/** Shape of the API the preload script exposes on window.api. */
export interface DearDiaryApi {
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  testProvider(): Promise<{ ok: boolean; message: string }>
  getDay(day: string): Promise<DayData>
  listDays(): Promise<string[]>
  generateSummary(day: string): Promise<string>
  chat(day: string, question: string, history: ChatMessage[]): Promise<string>
  getStandup(day: string): Promise<string>
  improveStandup(day: string): Promise<string>
  setPaused(paused: boolean): Promise<void>
  getStatus(): Promise<CaptureStatus>
  analyzeNow(): Promise<void>
  onStatus(cb: (status: CaptureStatus) => void): () => void
}
