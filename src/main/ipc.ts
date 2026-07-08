import { ipcMain } from 'electron'
import type { JournalDb } from './db'
import type { SettingsStore } from './settings'
import type { AnalysisPipeline } from './pipeline'
import type { StatusBus } from './status'
import { createProvider, isProviderConfigured } from './ai/provider'
import {
  buildChatSystemPrompt,
  buildStandupPolishPrompt,
  buildSummaryPrompt,
  chatHistoryToPrompt
} from '../shared/analysis/prompts'
import { buildStandup } from '../shared/analysis/standup'
import { computeDayStats } from '../shared/analysis/stats'
import { dayStart, dayEnd, isDayKey, shiftDay } from '../shared/time'
import type { ChatMessage, DayData, Settings } from '../shared/types'

export function registerIpc(
  db: JournalDb,
  settings: SettingsStore,
  pipeline: AnalysisPipeline,
  status: StatusBus
): void {
  ipcMain.handle('settings:get', () => settings.get())

  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    const next = settings.update(patch)
    status.update({
      paused: next.paused,
      providerConfigured: isProviderConfigured(next)
    })
    return next
  })

  ipcMain.handle('provider:test', async () => {
    try {
      const s = settings.get()
      if (!isProviderConfigured(s)) {
        return { ok: false, message: 'Provider is not configured (missing API key or URL).' }
      }
      const provider = createProvider(s)
      const reply = await provider.generateText(
        'You are a connectivity check. Reply with exactly: OK',
        'Reply with exactly: OK'
      )
      return { ok: true, message: `Connected to ${provider.name}: ${reply.slice(0, 80)}` }
    } catch (err) {
      return { ok: false, message: (err as Error).message }
    }
  })

  ipcMain.handle('day:get', (_e, day: string): DayData => {
    requireDay(day)
    const cards = db.getCards(day)
    return {
      day,
      cards,
      summary: db.getSummary(day),
      stats: computeDayStats(cards),
      screenshotCount: db.countScreenshotsForDay(dayStart(day), dayEnd(day))
    }
  })

  ipcMain.handle('days:list', () => db.listDays())

  ipcMain.handle('summary:generate', async (_e, day: string) => {
    requireDay(day)
    const cards = db.getCards(day)
    if (cards.length === 0) throw new Error('No recorded activity for this day yet.')
    const provider = createProvider(settings.get())
    const text = await provider.generateText(
      'You write concise, factual work-journal entries.',
      buildSummaryPrompt(day, cards)
    )
    db.setSummary(day, text.trim())
    return text.trim()
  })

  ipcMain.handle(
    'chat:ask',
    async (_e, day: string, question: string, history: ChatMessage[]) => {
      requireDay(day)
      const cards = db.getCards(day)
      const provider = createProvider(settings.get())
      const system = buildChatSystemPrompt(day, cards, db.getSummary(day))
      const answer = await provider.generateText(
        system,
        chatHistoryToPrompt(Array.isArray(history) ? history : [], question)
      )
      return answer.trim()
    }
  )

  ipcMain.handle('standup:get', (_e, day: string) => {
    requireDay(day)
    return buildStandup(db.getCards(shiftDay(day, -1)), db.getCards(day))
  })

  ipcMain.handle('standup:improve', async (_e, day: string) => {
    requireDay(day)
    const yesterday = db.getCards(shiftDay(day, -1))
    const today = db.getCards(day)
    const draft = buildStandup(yesterday, today)
    const provider = createProvider(settings.get())
    const text = await provider.generateText(
      'You edit standup updates for busy professionals.',
      buildStandupPolishPrompt(draft, [...yesterday, ...today])
    )
    return text.trim()
  })

  ipcMain.handle('capture:setPaused', (_e, paused: boolean) => {
    settings.update({ paused: Boolean(paused) })
    status.update({ paused: Boolean(paused) })
  })

  ipcMain.handle('status:get', () => status.get())

  ipcMain.handle('pipeline:runNow', () => pipeline.runNow())
}

function requireDay(day: string): void {
  if (typeof day !== 'string' || !isDayKey(day)) {
    throw new Error(`Invalid day key: ${String(day)}`)
  }
}
