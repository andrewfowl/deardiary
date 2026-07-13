import { contextBridge, ipcRenderer } from 'electron'
import type { CaptureStatus, ChatMessage, DearDiaryApi, Settings } from '../shared/types'

const api: DearDiaryApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:set', patch),
  testProvider: () => ipcRenderer.invoke('provider:test'),
  getDay: (day: string) => ipcRenderer.invoke('day:get', day),
  listDays: () => ipcRenderer.invoke('days:list'),
  generateSummary: (day: string) => ipcRenderer.invoke('summary:generate', day),
  chat: (day: string, question: string, history: ChatMessage[]) =>
    ipcRenderer.invoke('chat:ask', day, question, history),
  getStandup: (day: string) => ipcRenderer.invoke('standup:get', day),
  improveStandup: (day: string) => ipcRenderer.invoke('standup:improve', day),
  setPaused: (paused: boolean) => ipcRenderer.invoke('capture:setPaused', paused),
  getStatus: () => ipcRenderer.invoke('status:get'),
  analyzeNow: () => ipcRenderer.invoke('pipeline:runNow'),
  getLicense: () => ipcRenderer.invoke('license:get'),
  activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),
  openExternal: (url: string) => ipcRenderer.invoke('shell:open', url),
  onStatus: (cb: (status: CaptureStatus) => void) => {
    const listener = (_event: unknown, status: CaptureStatus): void => cb(status)
    ipcRenderer.on('status:update', listener)
    return () => ipcRenderer.removeListener('status:update', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
