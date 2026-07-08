import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Settings } from '../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  anthropicApiKey: '',
  anthropicModel: 'claude-opus-4-8',
  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  ollamaBaseUrl: 'http://localhost:11434/v1',
  ollamaModel: 'qwen2.5vl',
  captureIntervalSec: 30,
  batchMinutes: 15,
  idleThresholdSec: 180,
  retentionDays: 7,
  captureAllScreens: false,
  paused: false
}

/** JSON-file-backed settings store kept in the app's userData directory. */
export class SettingsStore {
  private readonly file: string
  private value: Settings

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'settings.json')
    this.value = this.load()
  }

  private load(): Settings {
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>
      return { ...DEFAULT_SETTINGS, ...raw }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  get(): Settings {
    return { ...this.value }
  }

  update(patch: Partial<Settings>): Settings {
    this.value = { ...this.value, ...patch }
    writeFileSync(this.file, JSON.stringify(this.value, null, 2), 'utf8')
    return this.get()
  }
}
