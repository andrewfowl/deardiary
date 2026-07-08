import Anthropic from '@anthropic-ai/sdk'
import type { AiProvider, FrameImage } from './provider'
import { OBSERVATIONS_SCHEMA } from '../../shared/analysis/prompts'

/**
 * Claude backend via the official Anthropic SDK. Frame analysis uses
 * structured outputs so the response is guaranteed-valid JSON.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic'
  private client: Anthropic

  constructor(
    apiKey: string,
    private model: string
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async analyzeFrames(prompt: string, images: FrameImage[]): Promise<string> {
    const content: Anthropic.ContentBlockParam[] = [
      ...images.map(
        (img): Anthropic.ImageBlockParam => ({
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: img.base64 }
        })
      ),
      { type: 'text', text: prompt }
    ]

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: {
        format: {
          type: 'json_schema',
          schema: OBSERVATIONS_SCHEMA as unknown as Record<string, unknown>
        }
      },
      messages: [{ role: 'user', content }]
    })

    return firstText(response)
  }

  async generateText(system: string, user: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system,
      messages: [{ role: 'user', content: user }]
    })
    return firstText(response)
  }
}

function firstText(response: Anthropic.Message): string {
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to process this request')
  }
  for (const block of response.content) {
    if (block.type === 'text') return block.text
  }
  throw new Error('Claude returned no text content')
}
