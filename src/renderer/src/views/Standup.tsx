import { useEffect, useState } from 'react'
import { api } from '../api'
import DayPicker from '../components/DayPicker'

interface Props {
  day: string
  setDay: (day: string) => void
}

export default function Standup({ day, setDay }: Props): React.JSX.Element {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    api.getStandup(day).then(setText).catch((err: Error) => setError(err.message))
  }, [day])

  const polish = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      setText(await api.improveStandup(day))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="view">
      <header className="view-header">
        <h1>Standup</h1>
        <DayPicker day={day} setDay={setDay} />
      </header>
      <p className="muted">
        An update drafted from what you actually did — no more reconstructing yesterday from
        memory.
      </p>
      {error && <div className="banner warn">{error}</div>}
      <div className="panel">
        <textarea
          className="standup-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
        />
        <div className="row gap">
          <button className="btn" onClick={() => void copy()}>
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
          <button className="btn ghost" onClick={() => void polish()} disabled={busy}>
            {busy ? 'Polishing…' : 'Polish with AI'}
          </button>
        </div>
      </div>
    </div>
  )
}
