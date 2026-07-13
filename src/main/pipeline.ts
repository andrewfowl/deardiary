import { readFileSync, rmSync } from 'node:fs'
import type { JournalDb, ScreenshotRow } from './db'
import type { SettingsStore } from './settings'
import { createProvider, isProviderConfigured, type FrameImage } from './ai/provider'
import { buildAnalysisPrompt, parseObservations } from '../shared/analysis/prompts'
import { mergeObservations } from '../shared/analysis/merge'
import { sampleEvenly } from '../shared/analysis/sample'
import { dayKey, dayEnd } from '../shared/time'
import type { Observation } from '../shared/types'

const TICK_MS = 30_000
const MAX_FRAMES_PER_BATCH = 20
const MAX_ROWS_PER_BATCH = 120
const ERROR_BACKOFF_MS = 5 * 60_000
const RETENTION_SWEEP_MS = 60 * 60_000

/**
 * Watches for unanalyzed screenshots and, once a batch window has
 * accumulated, sends a sampled set of frames to the configured AI provider,
 * turning them into observations and merged timeline cards. Also enforces
 * screenshot retention.
 */
export class AnalysisPipeline {
  private timer: NodeJS.Timeout | null = null
  private retentionTimer: NodeJS.Timeout | null = null
  private running = false
  private backoffUntil = 0

  constructor(
    private db: JournalDb,
    private settings: SettingsStore,
    /** Entitlement gate — false while the trial/license has expired. */
    private isAllowed: () => boolean,
    private onUpdate: (patch: {
      analyzing?: boolean
      lastBatchTs?: number
      pendingScreenshots?: number
      lastError?: string | null
    }) => void
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(false), TICK_MS)
    this.retentionTimer = setInterval(() => this.sweepRetention(), RETENTION_SWEEP_MS)
    this.sweepRetention()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.retentionTimer) clearInterval(this.retentionTimer)
    this.timer = null
    this.retentionTimer = null
  }

  /** Manual "analyze now" trigger from the UI. */
  async runNow(): Promise<void> {
    this.backoffUntil = 0
    await this.tick(true)
  }

  private async tick(force: boolean): Promise<void> {
    if (this.running) return
    const now = Date.now()
    if (!force && now < this.backoffUntil) return

    const s = this.settings.get()
    this.onUpdate({ pendingScreenshots: this.db.countUnanalyzed() })
    if (!isProviderConfigured(s)) return
    if (!this.isAllowed()) return

    // Only consider screenshots that are at least a few seconds old so we
    // never race an in-progress capture.
    const rows = this.db.listUnanalyzed(now - 10_000)
    if (rows.length === 0) return

    const windowMs = s.batchMinutes * 60_000
    const oldestAge = now - rows[0].ts
    if (!force && oldestAge < windowMs) return

    this.running = true
    this.onUpdate({ analyzing: true })
    try {
      const batch = rows.slice(0, MAX_ROWS_PER_BATCH)
      await this.analyzeBatch(batch)
      this.onUpdate({
        analyzing: false,
        lastBatchTs: Date.now(),
        pendingScreenshots: this.db.countUnanalyzed(),
        lastError: null
      })
    } catch (err) {
      this.backoffUntil = Date.now() + ERROR_BACKOFF_MS
      this.onUpdate({
        analyzing: false,
        lastError: `Analysis failed: ${(err as Error).message}`
      })
    } finally {
      this.running = false
    }
  }

  private async analyzeBatch(rows: ScreenshotRow[]): Promise<void> {
    const sampled = sampleEvenly(rows, MAX_FRAMES_PER_BATCH)
    const images: FrameImage[] = []
    for (const row of sampled) {
      try {
        images.push({ base64: readFileSync(row.path).toString('base64'), timestamp: row.ts })
      } catch {
        // Screenshot file was deleted (e.g. by retention); skip it.
      }
    }
    if (images.length === 0) {
      this.db.markAnalyzed(rows.map((r) => r.id))
      return
    }

    const provider = createProvider(this.settings.get())
    const prompt = buildAnalysisPrompt(images.map((img) => img.timestamp))
    const responseText = await provider.analyzeFrames(prompt, images)

    const day = dayKey(images[0].timestamp)
    this.applyObservations(parseObservations(responseText, day))

    // Mark the whole batch (sampled or not) so it is never re-sent.
    this.db.markAnalyzed(rows.map((r) => r.id))
  }

  private applyObservations(observations: Observation[]): void {
    if (observations.length === 0) return
    // A batch near midnight can produce observations spilling into the next
    // day; group by the day each observation starts on.
    const byDay = new Map<string, Observation[]>()
    for (const obs of observations) {
      const obsDay = dayKey(obs.startTs)
      const clipped = { ...obs, endTs: Math.min(obs.endTs, dayEnd(obsDay)) }
      const list = byDay.get(obsDay) ?? []
      list.push(clipped)
      byDay.set(obsDay, list)
    }
    for (const [obsDay, list] of byDay) {
      this.db.insertObservations(obsDay, list)
      const merged = mergeObservations(obsDay, this.db.getCards(obsDay), list)
      this.db.replaceDayCards(obsDay, merged)
    }
  }

  private sweepRetention(): void {
    const s = this.settings.get()
    const cutoff = Date.now() - s.retentionDays * 24 * 60 * 60_000
    const paths = this.db.deleteScreenshotsBefore(cutoff)
    for (const path of paths) {
      try {
        rmSync(path, { force: true })
      } catch {
        // best effort
      }
    }
  }
}
