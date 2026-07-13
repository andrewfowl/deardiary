import type { ProviderId, Settings } from '../../../shared/types'

export const PROVIDERS: Array<{ id: ProviderId; label: string; note: string }> = [
  { id: 'gemini', label: 'Google Gemini', note: 'Free tier available — the easiest way to start.' },
  { id: 'anthropic', label: 'Anthropic Claude', note: 'Highest-quality summaries and chat.' },
  { id: 'openai', label: 'OpenAI (or compatible)', note: 'Any OpenAI-compatible endpoint.' },
  { id: 'ollama', label: 'Ollama (local)', note: 'Fully offline — nothing ever leaves your PC.' }
]

interface Props {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}

/** Provider picker + credential fields, shared by Settings and Onboarding. */
export default function ProviderForm({ settings, onChange }: Props): React.JSX.Element {
  return (
    <>
      <div className="provider-grid">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            className={`provider-card ${settings.provider === p.id ? 'selected' : ''}`}
            onClick={() => onChange({ provider: p.id })}
          >
            <div className="provider-name">{p.label}</div>
            <div className="provider-note">{p.note}</div>
          </button>
        ))}
      </div>

      {settings.provider === 'gemini' && (
        <>
          <Field label="Gemini API key">
            <input
              type="password"
              value={settings.geminiApiKey}
              onChange={(e) => onChange({ geminiApiKey: e.target.value })}
              placeholder="AIza…"
            />
          </Field>
          <Field label="Model">
            <input
              value={settings.geminiModel}
              onChange={(e) => onChange({ geminiModel: e.target.value })}
            />
          </Field>
        </>
      )}
      {settings.provider === 'anthropic' && (
        <>
          <Field label="Anthropic API key">
            <input
              type="password"
              value={settings.anthropicApiKey}
              onChange={(e) => onChange({ anthropicApiKey: e.target.value })}
              placeholder="sk-ant-…"
            />
          </Field>
          <Field label="Model">
            <input
              value={settings.anthropicModel}
              onChange={(e) => onChange({ anthropicModel: e.target.value })}
            />
          </Field>
        </>
      )}
      {settings.provider === 'openai' && (
        <>
          <Field label="API key">
            <input
              type="password"
              value={settings.openaiApiKey}
              onChange={(e) => onChange({ openaiApiKey: e.target.value })}
              placeholder="sk-…"
            />
          </Field>
          <Field label="Base URL">
            <input
              value={settings.openaiBaseUrl}
              onChange={(e) => onChange({ openaiBaseUrl: e.target.value })}
            />
          </Field>
          <Field label="Model (must support vision)">
            <input
              value={settings.openaiModel}
              onChange={(e) => onChange({ openaiModel: e.target.value })}
            />
          </Field>
        </>
      )}
      {settings.provider === 'ollama' && (
        <>
          <Field label="Ollama base URL">
            <input
              value={settings.ollamaBaseUrl}
              onChange={(e) => onChange({ ollamaBaseUrl: e.target.value })}
            />
          </Field>
          <Field label="Model (must support vision, e.g. qwen2.5vl, llava)">
            <input
              value={settings.ollamaModel}
              onChange={(e) => onChange({ ollamaModel: e.target.value })}
            />
          </Field>
        </>
      )}
    </>
  )
}

export function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
