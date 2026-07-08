import type { BrowserWindow } from 'electron'
import type { CaptureStatus } from '../shared/types'

/** Holds live capture/analysis status and pushes changes to the renderer. */
export class StatusBus {
  private status: CaptureStatus = {
    recording: true,
    paused: false,
    locked: false,
    idle: false,
    lastCaptureTs: null,
    pendingScreenshots: 0,
    lastBatchTs: null,
    analyzing: false,
    lastError: null,
    providerConfigured: false
  }

  private window: BrowserWindow | null = null

  attach(window: BrowserWindow): void {
    this.window = window
  }

  get(): CaptureStatus {
    return { ...this.status }
  }

  update(patch: Partial<CaptureStatus>): void {
    this.status = { ...this.status, ...patch }
    this.status.recording = !this.status.paused && !this.status.locked && !this.status.idle
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('status:update', this.get())
    }
  }
}
