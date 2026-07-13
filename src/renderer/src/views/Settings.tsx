import { useEffect, useState } from 'react'
import { api } from './../api'
import ProviderForm, { Field } from '../components/ProviderForm'
import { KeyIcon } from '../components/Icons'
import type { LicenseStatus, Settings } from '../../../shared/types'
import { BUY_URL } from '../../../shared/links'

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
        <ProviderForm settings={settings} onChange={patch} />
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

      <LicensePanel />
    </div>
  )
}

function LicensePanel(): React.JSX.Element {
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [key, setKey] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void api.getLicense().then(setLicense)
  }, [])

  const activate = async (): Promise<void> => {
    setBusy(true)
    setResult(null)
    try {
      const res = await api.activateLicense(key)
      setResult(res)
      if (res.ok) {
        setKey('')
        setLicense(await api.getLicense())
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3 className="row gap-sm">
          <KeyIcon /> License
        </h3>
        {license && <LicenseStateChip license={license} />}
      </div>
      {license && <LicenseDetails license={license} />}
      <Field label="License key">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="DDRY-…"
          spellCheck={false}
        />
      </Field>
      <div className="row gap">
        <button className="btn" onClick={() => void activate()} disabled={busy || !key.trim()}>
          {busy ? 'Activating…' : 'Activate'}
        </button>
        <button className="btn ghost" onClick={() => void api.openExternal(BUY_URL)}>
          {license?.state === 'licensed' ? 'Manage / renew' : 'Buy a license'}
        </button>
      </div>
      {result && <div className={`banner ${result.ok ? 'ok' : 'warn'}`}>{result.message}</div>}
    </div>
  )
}

function LicenseStateChip({ license }: { license: LicenseStatus }): React.JSX.Element {
  const map: Record<string, { label: string; cls: string }> = {
    trial: { label: `Trial · ${license.trialDaysLeft}d left`, cls: '' },
    trial_expired: { label: 'Trial ended', cls: 'distraction' },
    licensed: { label: license.plan === 'lifetime' ? 'Lifetime' : 'Annual', cls: 'ok-chip' },
    license_expired: { label: 'Expired', cls: 'distraction' }
  }
  const entry = map[license.state]
  return <span className={`chip ${entry.cls}`}>{entry.label}</span>
}

function LicenseDetails({ license }: { license: LicenseStatus }): React.JSX.Element {
  if (license.state === 'licensed') {
    return (
      <p className="muted">
        Licensed to <strong>{license.email}</strong>
        {license.plan === 'annual' && license.expiresAt
          ? ` — renews ${new Date(license.expiresAt).toLocaleDateString()}.`
          : ' — lifetime, no expiry.'}
      </p>
    )
  }
  if (license.state === 'trial') {
    return (
      <p className="muted">
        You're on the free trial ({license.trialDaysLeft} days left). Buy a license to keep
        recording after it ends — one-time or annual.
      </p>
    )
  }
  return (
    <p className="muted">
      Recording is paused. Your recorded history stays fully accessible — activate a license to
      resume recording and analysis.
    </p>
  )
}

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
