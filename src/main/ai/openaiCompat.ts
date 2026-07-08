import type { AiProvider, FrameImage } from './provider'

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/**
 * OpenAI-compatible chat-completions backend. Covers OpenAI itself as well
 * as local servers speaking the same protocol (Ollama, LM Studio) — the
 * fully-offline privacy option.
 */
export class OpenAiCompatProvider implements AiProvider {
  constructor(
    readonly name: string,
    private baseUrl: string,
    private apiKey: string,
    private model: string
  ) {}

  async analyzeFrames(prompt: string, images: FrameImage[]): Promise<string> {
    const content = [
      { type: 'text', text: prompt },
      ...images.map((img) => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${img.base64}` }
      }))
    ]
    return this.complete([{ role: 'user', content }], true)
  }

  async generateText(system: string, user: string): Promise<string> {
    return this.complete(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      false
    )
  }

  private async complete(messages: unknown[], json: boolean): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(json ? { response_format: { type: 'json_object' } } : {})
      })
    })
    const body = (await res.json()) as ChatCompletionResponse
    if (!res.ok) {
      throw new Error(`${this.name} error ${res.status}: ${body.error?.message ?? 'unknown'}`)
    }
    const text = body.choices?.[0]?.message?.content
    if (!text) throw new Error(`${this.name} returned no text content`)
    return text
  }
}
