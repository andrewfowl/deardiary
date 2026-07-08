import type { DearDiaryApi } from '../../shared/types'

declare global {
  interface Window {
    api: DearDiaryApi
  }
}

export const api = window.api
