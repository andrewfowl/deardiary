import type { Settings } from '../../shared/types'
import { GeminiProvider } from './gemini'
import { AnthropicProvider } from './anthropic'
import { OpenAiCompatProvider } from './openaiCompat'

export interface FrameImage {
  /** Base64-encoded JPEG. */
  base64: string
  timestamp: number
}

/**
 * A vision-capable LLM backend. `analyzeFrames` must return JSON text
 * matching OBSERVATIONS_SCHEMA (parsing stays defensive downstream).
 */
export interface AiProvider {
  readonly name: string
  analyzeFrames(prompt: string, images: FrameImage[]): Promise<string>
  generateText(system: string, user: string): Promise<string>
}

export function isProviderConfigured(settings: Settings): boolean {
  switch (settings.provider) {
    case 'gemini':
      return settings.geminiApiKey.trim().length > 0
    case 'anthropic':
      return settings.anthropicApiKey.trim().length > 0
    case 'openai':
      return settings.openaiApiKey.trim().length > 0
    case 'ollama':
      return settings.ollamaBaseUrl.trim().length > 0
  }
}

export function createProvider(settings: Settings): AiProvider {
  switch (settings.provider) {
    case 'gemini':
      return new GeminiProvider(settings.geminiApiKey, settings.geminiModel)
    case 'anthropic':
      return new AnthropicProvider(settings.anthropicApiKey, settings.anthropicModel)
    case 'openai':
      return new OpenAiCompatProvider(
        'openai',
        settings.openaiBaseUrl,
        settings.openaiApiKey,
        settings.openaiModel
      )
    case 'ollama':
      return new OpenAiCompatProvider(
        'ollama',
        settings.ollamaBaseUrl,
        '',
        settings.ollamaModel
      )
  }
}
