import { useEffect, useState } from 'react'
import { api } from '../api'
import DayPicker from '../components/DayPicker'
import type { DayData } from '../../../shared/types'
import { CATEGORIES } from '../../../shared/categories'
import { formatDuration } from '../../../shared/time'

interface Props {
  day: string
  setDay: (day: string) => void
}

export default function Journal({ day, setDay }: Props): React.JSX.Element {
  const [data, setData] = useState<DayData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    api.getDay(day).then(setData).catch((err: Error) => setError(err.message))
  }, [day])

  const generate = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const summary = await api.generateSummary(day)
      setData((d) => (d ? { ...d, summary } : d))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const stats = data?.stats

  return (
    <div className="view">
      <header className="view-header">
        <h1>Journal</h1>
        <DayPicker day={day} setDay={setDay} />
      </header>
      {error && <div className="banner warn">{error}</div>}

      {stats && (
        <div className="stat-row">
          <Stat label="Tracked" value={formatDuration(stats.totalMinutes)} />
          <Stat label="Focused" value={formatDuration(stats.focusMinutes)} />
          <Stat label="Longest focus" value={formatDuration(stats.longestFocusMinutes)} />
          <Stat label="Distraction" value={formatDuration(stats.distractionMinutes)} />
        </div>
      )}

      {stats && stats.totalMinutes > 0 && (
        <div className="panel">
          <h3>Where the time went</h3>
          {CATEGORIES.filter((c) => (stats.byCategory[c.id] ?? 0) > 0).map((c) => {
            const minutes = stats.byCategory[c.id] ?? 0
            const pct = Math.round((minutes / stats.totalMinutes) * 100)
            return (
              <div key={c.id} className="bar-row">
                <span className="bar-label">{c.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${pct}%`, background: c.color }} />
                </div>
                <span className="bar-value">{formatDuration(minutes)}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h3>Daily summary</h3>
          <button className="btn small" onClick={() => void generate()} disabled={busy}>
            {busy ? 'Writing…' : data?.summary ? 'Regenerate' : 'Generate'}
          </button>
        </div>
        {data?.summary ? (
          <div className="summary-text">{data.summary}</div>
        ) : (
          <p className="muted">
            {data && data.cards.length > 0
              ? 'Generate an AI-written journal entry from your recorded timeline.'
              : 'Record some activity first, then generate a summary.'}
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
