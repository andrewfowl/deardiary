import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import DayPicker from '../components/DayPicker'
import type { CaptureStatus, DayData, TimelineCard } from '../../../shared/types'
import { categoryInfo } from '../../../shared/categories'
import { formatDuration, formatHHMM, minutesBetween } from '../../../shared/time'

interface Props {
  day: string
  setDay: (day: string) => void
  status: CaptureStatus | null
}

export default function Timeline({ day, setDay, status }: Props): React.JSX.Element {
  const [data, setData] = useState<DayData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    api
      .getDay(day)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((err: Error) => setError(err.message))
  }, [day])

  useEffect(() => {
    reload()
    const timer = setInterval(reload, 60_000)
    return () => clearInterval(timer)
  }, [reload])

  // Refresh right after an analysis batch lands.
  useEffect(() => {
    if (status?.lastBatchTs) reload()
  }, [status?.lastBatchTs, reload])

  return (
    <div className="view">
      <header className="view-header">
        <h1>Timeline</h1>
        <DayPicker day={day} setDay={setDay} />
      </header>
      {error && <div className="banner warn">{error}</div>}
      {data && data.cards.length > 0 && <Ribbon cards={data.cards} />}
      {data && data.cards.length === 0 && (
        <EmptyState screenshotCount={data.screenshotCount} status={status} />
      )}
      <div className="cards">
        {data?.cards.map((card) => <Card key={`${card.startTs}-${card.id ?? 0}`} card={card} />)}
      </div>
    </div>
  )
}

function Ribbon({ cards }: { cards: TimelineCard[] }): React.JSX.Element {
  const start = Math.min(...cards.map((c) => c.startTs))
  const end = Math.max(...cards.map((c) => c.endTs))
  const span = Math.max(end - start, 1)
  return (
    <div>
      <div className="ribbon">
        {cards.map((card, i) => (
          <div
            key={i}
            className="ribbon-seg"
            title={`${formatHHMM(card.startTs)} ${card.title}`}
            style={{
              left: `${((card.startTs - start) / span) * 100}%`,
              width: `${Math.max(((card.endTs - card.startTs) / span) * 100, 0.4)}%`,
              background: categoryInfo(card.category).color
            }}
          />
        ))}
      </div>
      <div className="ribbon-labels">
        <span>{formatHHMM(start)}</span>
        <span>{formatHHMM(end)}</span>
      </div>
    </div>
  )
}

function Card({ card }: { card: TimelineCard }): React.JSX.Element {
  const info = categoryInfo(card.category)
  const minutes = minutesBetween(card.startTs, card.endTs)
  return (
    <div className="card">
      <div className="card-time">
        <span>{formatHHMM(card.startTs)}</span>
        <span className="card-duration">{formatDuration(minutes)}</span>
      </div>
      <div className="card-rail" style={{ background: info.color }} />
      <div className="card-body">
        <div className="card-title-row">
          <span className="card-title">{card.title}</span>
          <span className="chip" style={{ borderColor: info.color, color: info.color }}>
            {info.label}
          </span>
          {card.distraction && <span className="chip distraction">distraction</span>}
        </div>
        <p className="card-summary">{card.summary}</p>
      </div>
    </div>
  )
}

function EmptyState({
  screenshotCount,
  status
}: {
  screenshotCount: number
  status: CaptureStatus | null
}): React.JSX.Element {
  return (
    <div className="empty">
      <h2>No timeline yet</h2>
      {!status?.providerConfigured ? (
        <p>
          Add an AI provider key in <strong>Settings</strong> to start turning your screen
          recordings into a journal.
        </p>
      ) : screenshotCount > 0 ? (
        <>
          <p>
            {screenshotCount} screenshots captured for this day — the next analysis batch will
            build your timeline.
          </p>
          <button className="btn" onClick={() => void api.analyzeNow()}>
            Analyze now
          </button>
        </>
      ) : (
        <p>Nothing recorded for this day. DearDiary records automatically while you work.</p>
      )}
    </div>
  )
}
