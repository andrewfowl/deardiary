import { desktopCapturer, powerMonitor, screen } from 'electron'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { JournalDb } from './db'
import type { SettingsStore } from './settings'
import { dayKey } from '../shared/time'

const TICK_MS = 5_000

/**
 * Periodically snapshots the screen(s) into local JPEG files and records
 * them in the database for the analysis pipeline. Skips capture while the
 * user is idle, the session is locked, or recording is paused.
 */
export class CaptureService {
  private timer: NodeJS.Timeout | null = null
  private lastCaptureTs = 0
  private locked = false
  private capturing = false

  constructor(
    private db: JournalDb,
    private settings: SettingsStore,
    private screenshotsDir: string,
    private onUpdate: (patch: {
      locked?: boolean
      idle?: boolean
      lastCaptureTs?: number
      lastError?: string | null
    }) => void
  ) {}

  start(): void {
    powerMonitor.on('lock-screen', () => {
      this.locked = true
      this.onUpdate({ locked: true })
    })
    powerMonitor.on('unlock-screen', () => {
      this.locked = false
      this.onUpdate({ locked: false })
    })
    this.timer = setInterval(() => void this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async tick(): Promise<void> {
    const s = this.settings.get()
    if (s.paused || this.locked || this.capturing) return

    const now = Date.now()
    if (now - this.lastCaptureTs < s.captureIntervalSec * 1000) return

    const idleSec = powerMonitor.getSystemIdleTime()
    const idle = idleSec >= s.idleThresholdSec
    this.onUpdate({ idle })
    if (idle) return

    this.capturing = true
    try {
      await this.captureOnce(s.captureAllScreens)
      this.lastCaptureTs = now
      this.onUpdate({ lastCaptureTs: now, lastError: null })
    } catch (err) {
      this.onUpdate({ lastError: `Capture failed: ${(err as Error).message}` })
    } finally {
      this.capturing = false
    }
  }

  private async captureOnce(allScreens: boolean): Promise<void> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1600, height: 1000 }
    })
    if (sources.length === 0) throw new Error('no screen sources available')

    const primaryId = String(screen.getPrimaryDisplay().id)
    const selected = allScreens
      ? sources
      : [sources.find((src) => src.display_id === primaryId) ?? sources[0]]

    const ts = Date.now()
    const dir = join(this.screenshotsDir, dayKey(ts))
    mkdirSync(dir, { recursive: true })

    selected.forEach((source, index) => {
      const image = source.thumbnail
      if (image.isEmpty()) return
      const file = join(dir, `${ts}-${index}.jpg`)
      writeFileSync(file, image.toJPEG(60))
      this.db.insertScreenshot(ts, file)
    })
  }
}
