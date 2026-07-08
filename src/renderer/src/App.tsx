import { useEffect, useState } from 'react'
import { api } from './api'
import type { CaptureStatus } from '../../shared/types'
import { dayKey } from '../../shared/time'
import Timeline from './views/Timeline'
import Journal from './views/Journal'
import Chat from './views/Chat'
import Standup from './views/Standup'
import SettingsView from './views/Settings'

type View = 'timeline' | 'journal' | 'chat' | 'standup' | 'settings'

const NAV: Array<{ id: View; label: string; icon: string }> = [
  { id: 'timeline', label: 'Timeline', icon: '▤' },
  { id: 'journal', label: 'Journal', icon: '✎' },
  { id: 'chat', label: 'Ask your day', icon: '💬' },
  { id: 'standup', label: 'Standup', icon: '📣' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('timeline')
  const [day, setDay] = useState<string>(dayKey(Date.now()))
  const [status, setStatus] = useState<CaptureStatus | null>(null)

  useEffect(() => {
    void api.getStatus().then(setStatus)
    return api.onStatus(setStatus)
  }, [])

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
        <StatusFooter status={status} />
      </aside>
      <main className="content">
        {view === 'timeline' && <Timeline day={day} setDay={setDay} status={status} />}
        {view === 'journal' && <Journal day={day} setDay={setDay} />}
        {view === 'chat' && <Chat day={day} setDay={setDay} />}
        {view === 'standup' && <Standup day={day} setDay={setDay} />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

function StatusFooter({ status }: { status: CaptureStatus | null }): React.JSX.Element {
  if (!status) return <div className="status-footer" />
  const state = status.paused
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
      {status.analyzing && <div className="status-sub">Analyzing batch…</div>}
      {!status.analyzing && status.pendingScreenshots > 0 && (
        <div className="status-sub">{status.pendingScreenshots} shots pending analysis</div>
      )}
      {!status.providerConfigured && (
        <div className="status-sub warn">No AI provider configured</div>
      )}
      {status.lastError && <div className="status-sub warn">{status.lastError}</div>}
      <button
        className="btn small"
        onClick={() => void api.setPaused(!status.paused)}
        style={{ marginTop: 8 }}
      >
        {status.paused ? 'Resume' : 'Pause'} recording
      </button>
    </div>
  )
}
