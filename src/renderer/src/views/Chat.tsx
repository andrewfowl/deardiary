import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import DayPicker from '../components/DayPicker'
import type { ChatMessage } from '../../../shared/types'

interface Props {
  day: string
  setDay: (day: string) => void
}

const SUGGESTIONS = [
  'What did I work on this morning?',
  'How much time did I spend in meetings?',
  'When did I get distracted?',
  'What should I pick back up tomorrow?'
]

export default function Chat({ day, setDay }: Props): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([])
  }, [day])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const ask = async (question: string): Promise<void> => {
    const q = question.trim()
    if (!q || busy) return
    setInput('')
    const history = messages
    setMessages([...history, { role: 'user', text: q }])
    setBusy(true)
    try {
      const answer = await api.chat(day, q, history)
      setMessages((m) => [...m, { role: 'assistant', text: answer }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: `⚠ ${(err as Error).message}` }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="view chat-view">
      <header className="view-header">
        <h1>Ask your day</h1>
        <DayPicker day={day} setDay={setDay} />
      </header>
      <div className="chat-log">
        {messages.length === 0 && (
          <div className="empty">
            <h2>Ask anything about this day</h2>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn ghost" onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="msg assistant muted">Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What was I doing at 3pm?"
          disabled={busy}
        />
        <button className="btn" type="submit" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  )
}
