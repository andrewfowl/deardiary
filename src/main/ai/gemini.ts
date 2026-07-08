import type { AiProvider, FrameImage } from './provider'

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
  error?: { message?: string }
}

/**
 * Google Gemini backend (REST). The default choice, like Dayflow, because
 * Gemini has a generous free tier for personal use.
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini'

  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async analyzeFrames(prompt: string, images: FrameImage[]): Promise<string> {
    const parts = [
      ...images.map((img) => ({
        inline_data: { mime_type: 'image/jpeg', data: img.base64 }
      })),
      { text: prompt }
    ]
    return this.generate([{ role: 'user', parts }], { responseMimeType: 'application/json' })
  }

  async generateText(system: string, user: string): Promise<string> {
    return this.generate(
      [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
      undefined
    )
  }

  private async generate(
    contents: unknown[],
    generationConfig: Record<string, unknown> | undefined
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({ contents, ...(generationConfig ? { generationConfig } : {}) })
    })
    const body = (await res.json()) as GeminiResponse
    if (!res.ok) {
      throw new Error(`Gemini error ${res.status}: ${body.error?.message ?? 'unknown'}`)
    }
    const text = body.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
    if (!text) throw new Error('Gemini returned no text content')
    return text
  }
}
