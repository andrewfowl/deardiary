import { useEffect, useState } from 'react'
import { api } from '../api'
import type { ProviderId, Settings } from '../../../shared/types'

const PROVIDERS: Array<{ id: ProviderId; label: string; note: string }> = [
  { id: 'gemini', label: 'Google Gemini', note: 'Free tier available — the easiest way to start.' },
  { id: 'anthropic', label: 'Anthropic Claude', note: 'Highest-quality summaries and chat.' },
  { id: 'openai', label: 'OpenAI (or compatible)', note: 'Any OpenAI-compatible endpoint.' },
  { id: 'ollama', label: 'Ollama (local)', note: 'Fully offline — nothing ever leaves your PC.' }
]

export default function SettingsView(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    void api.getSettings().then(setSettings)
  }, [])

  if (!settings) return <div className="view" />

  const patch = (p: Partial<Settings>): void => setSettings({ ...settings, ...p })

  const save = async (): Promise<void> => {
    const next = await api.setSettings(settings)
    setSettings(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const test = async (): Promise<void> => {
    await save()
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await api.testProvider())
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Settings</h1>
      </header>

      <div className="panel">
        <h3>AI provider</h3>
        <p className="muted">
          Screenshots are analyzed by the provider you choose. With Ollama everything stays on
          your machine.
        </p>
        <div className="provider-grid">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              className={`provider-card ${settings.provider === p.id ? 'selected' : ''}`}
              onClick={() => patch({ provider: p.id })}
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
                onChange={(e) => patch({ geminiApiKey: e.target.value })}
                placeholder="AIza…"
              />
            </Field>
            <Field label="Model">
              <input
                value={settings.geminiModel}
                onChange={(e) => patch({ geminiModel: e.target.value })}
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
                onChange={(e) => patch({ anthropicApiKey: e.target.value })}
                placeholder="sk-ant-…"
              />
            </Field>
            <Field label="Model">
              <input
                value={settings.anthropicModel}
                onChange={(e) => patch({ anthropicModel: e.target.value })}
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
                onChange={(e) => patch({ openaiApiKey: e.target.value })}
                placeholder="sk-…"
              />
            </Field>
            <Field label="Base URL">
              <input
                value={settings.openaiBaseUrl}
                onChange={(e) => patch({ openaiBaseUrl: e.target.value })}
              />
            </Field>
            <Field label="Model (must support vision)">
              <input
                value={settings.openaiModel}
                onChange={(e) => patch({ openaiModel: e.target.value })}
              />
            </Field>
          </>
        )}
        {settings.provider === 'ollama' && (
          <>
            <Field label="Ollama base URL">
              <input
                value={settings.ollamaBaseUrl}
                onChange={(e) => patch({ ollamaBaseUrl: e.target.value })}
              />
            </Field>
            <Field label="Model (must support vision, e.g. qwen2.5vl, llava)">
              <input
                value={settings.ollamaModel}
                onChange={(e) => patch({ ollamaModel: e.target.value })}
              />
            </Field>
          </>
        )}

        <div className="row gap">
          <button className="btn" onClick={() => void save()}>
            {saved ? 'Saved ✓' : 'Save'}
          </button>
          <button className="btn ghost" onClick={() => void test()} disabled={testing}>
            {testing ? 'Testing…' : 'Save & test connection'}
          </button>
        </div>
        {testResult && (
          <div className={`banner ${testResult.ok ? 'ok' : 'warn'}`}>{testResult.message}</div>
        )}
      </div>

      <div className="panel">
        <h3>Recording</h3>
        <div className="settings-grid">
          <Field label="Screenshot every (seconds)">
            <input
              type="number"
              min={10}
              max={300}
              value={settings.captureIntervalSec}
              onChange={(e) => patch({ captureIntervalSec: clampInt(e.target.value, 10, 300, 30) })}
            />
          </Field>
          <Field label="Analyze batches of (minutes)">
            <input
              type="number"
              min={5}
              max={60}
              value={settings.batchMinutes}
              onChange={(e) => patch({ batchMinutes: clampInt(e.target.value, 5, 60, 15) })}
            />
          </Field>
          <Field label="Pause when idle for (seconds)">
            <input
              type="number"
              min={60}
              max={1800}
              value={settings.idleThresholdSec}
              onChange={(e) => patch({ idleThresholdSec: clampInt(e.target.value, 60, 1800, 180) })}
            />
          </Field>
          <Field label="Keep screenshots for (days)">
            <input
              type="number"
              min={1}
              max={90}
              value={settings.retentionDays}
              onChange={(e) => patch({ retentionDays: clampInt(e.target.value, 1, 90, 7) })}
            />
          </Field>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={settings.captureAllScreens}
            onChange={(e) => patch({ captureAllScreens: e.target.checked })}
          />
          Capture all displays (default: primary display only)
        </label>
        <p className="muted">
          Screenshots and the journal database are stored only on this computer. Your timeline
          and summaries are kept forever; raw screenshots are deleted after the retention
          period.
        </p>
        <button className="btn" onClick={() => void save()}>
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
