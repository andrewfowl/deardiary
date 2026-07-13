import { useEffect, useState } from 'react'
import { api } from './api'
import type { CaptureStatus, LicenseStatus, Settings } from '../../shared/types'
import { dayKey } from '../../shared/time'
import { BUY_URL } from '../../shared/links'
import Timeline from './views/Timeline'
import Journal from './views/Journal'
import Chat from './views/Chat'
import Standup from './views/Standup'
import SettingsView from './views/Settings'
import Onboarding from './views/Onboarding'
import {
  TimelineIcon,
  JournalIcon,
  ChatIcon,
  SendIcon,
  SettingsIcon
} from './components/Icons'

type View = 'timeline' | 'journal' | 'chat' | 'standup' | 'settings'

const NAV: Array<{ id: View; label: string; icon: React.JSX.Element }> = [
  { id: 'timeline', label: 'Timeline', icon: <TimelineIcon /> },
  { id: 'journal', label: 'Journal', icon: <JournalIcon /> },
  { id: 'chat', label: 'Ask your day', icon: <ChatIcon /> },
  { id: 'standup', label: 'Standup', icon: <SendIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> }
]

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('timeline')
  const [day, setDay] = useState<string>(dayKey(Date.now()))
  const [status, setStatus] = useState<CaptureStatus | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    void api.getSettings().then(setSettings)
    void api.getStatus().then(setStatus)
    return api.onStatus(setStatus)
  }, [])

  if (!settings) return <div className="app" />

  if (!settings.onboarded) {
    return (
      <Onboarding
        settings={settings}
        onDone={() => void api.getSettings().then(setSettings)}
      />
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          DearDiary
        </div>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${view === item.id ? 'active' : ''}`}
              onClick={() => setView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <StatusFooter status={status} onOpenSettings={() => setView('settings')} />
      </aside>
      <main className="content">
        <LicenseBanner license={status?.license ?? null} onOpenSettings={() => setView('settings')} />
        {view === 'timeline' && <Timeline day={day} setDay={setDay} status={status} />}
        {view === 'journal' && <Journal day={day} setDay={setDay} />}
        {view === 'chat' && <Chat day={day} setDay={setDay} />}
        {view === 'standup' && <Standup day={day} setDay={setDay} />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

function LicenseBanner({
  license,
  onOpenSettings
}: {
  license: LicenseStatus | null
  onOpenSettings: () => void
}): React.JSX.Element | null {
  if (!license) return null

  const renewalSoon =
    license.state === 'licensed' &&
    license.plan === 'annual' &&
    license.expiresAt !== null &&
    license.expiresAt - Date.now() < 14 * 24 * 60 * 60_000

  if (license.state === 'licensed' && !renewalSoon) return null

  let text: string
  let cta = 'Buy a license'
  if (license.state === 'trial') {
    if (license.trialDaysLeft > 7) return null // don't nag early in the trial
    text = `Free trial — ${license.trialDaysLeft} day${license.trialDaysLeft === 1 ? '' : 's'} left.`
  } else if (license.state === 'trial_expired') {
    text = 'Your trial has ended. Recording is paused — your history stays available.'
  } else if (license.state === 'license_expired') {
    text = 'Your annual license has expired. Recording is paused — your history stays available.'
    cta = 'Renew'
  } else {
    text = `Your annual license renews soon (${new Date(license.expiresAt ?? 0).toLocaleDateString()}).`
    cta = 'Manage'
  }

  return (
    <div className="license-banner">
      <span>{text}</span>
      <span className="row gap-sm">
        <button className="btn small" onClick={() => void api.openExternal(BUY_URL)}>
          {cta}
        </button>
        <button className="btn small ghost" onClick={onOpenSettings}>
          Enter key
        </button>
      </span>
    </div>
  )
}

function StatusFooter({
  status,
  onOpenSettings
}: {
  status: CaptureStatus | null
  onOpenSettings: () => void
}): React.JSX.Element {
  if (!status) return <div className="status-footer" />
  const licensed = status.license?.state === 'licensed'
  const gateClosed =
    status.license?.state === 'trial_expired' || status.license?.state === 'license_expired'

  const state = gateClosed
    ? { dot: 'dot-paused', text: 'Not recording (license)' }
    : status.paused
      ? { dot: 'dot-paused', text: 'Paused' }
      : status.locked
        ? { dot: 'dot-paused', text: 'Screen locked' }
        : status.idle
          ? { dot: 'dot-idle', text: 'Idle — not recording' }
          : { dot: 'dot-on', text: 'Recording' }

  return (
    <div className="status-footer">
      <div className="status-line">
        <span className={`dot ${state.dot}`} />
        {state.text}
      </div>
      {status.license?.state === 'trial' && (
        <div className="status-sub">Trial · {status.license.trialDaysLeft} days left</div>
      )}
      {licensed && status.license?.plan === 'lifetime' && (
        <div className="status-sub">Lifetime license</div>
      )}
      {status.analyzing && <div className="status-sub">Analyzing batch…</div>}
      {!status.analyzing && status.pendingScreenshots > 0 && (
        <div className="status-sub">{status.pendingScreenshots} shots pending analysis</div>
      )}
      {!status.providerConfigured && (
        <button className="status-sub warn linklike" onClick={onOpenSettings}>
          No AI provider configured — fix in Settings
        </button>
      )}
      {status.lastError && <div className="status-sub warn">{status.lastError}</div>}
      <div className="row gap-sm" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={() => void api.setPaused(!status.paused)}>
          {status.paused ? 'Resume' : 'Pause'}
        </button>
        {!status.analyzing && status.pendingScreenshots > 0 && status.providerConfigured && (
          <button className="btn small ghost" onClick={() => void api.analyzeNow()}>
            Analyze now
          </button>
        )}
      </div>
    </div>
  )
}
