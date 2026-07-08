import { dayKey, formatDayLabel, shiftDay } from '../../../shared/time'

interface Props {
  day: string
  setDay: (day: string) => void
}

export default function DayPicker({ day, setDay }: Props): React.JSX.Element {
  const today = dayKey(Date.now())
  return (
    <div className="day-picker">
      <button className="btn small" onClick={() => setDay(shiftDay(day, -1))}>
        ‹
      </button>
      <span className="day-label">{formatDayLabel(day)}</span>
      <button
        className="btn small"
        onClick={() => setDay(shiftDay(day, 1))}
        disabled={day >= today}
      >
        ›
      </button>
      {day !== today && (
        <button className="btn small ghost" onClick={() => setDay(today)}>
          Today
        </button>
      )}
    </div>
  )
}
