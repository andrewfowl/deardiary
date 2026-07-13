import { useState } from 'react'
import { api } from '../api'
import ProviderForm from '../components/ProviderForm'
import { ShieldIcon, TimelineIcon, ChatIcon } from '../components/Icons'
import type { Settings } from '../../../shared/types'

interface Props {
  settings: Settings
  onDone: () => void
}

/**
 * First-run wizard. Nothing is recorded until the user finishes it —
 * capture is gated on settings.onboarded in the main process.
 */
export default function Onboarding({ settings: initial, onDone }: Props): React.JSX.Element {
  const [step, setStep] = useState(0)
  const [settings, setSettings] = useState<Settings>(initial)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)

  const patch = (p: Partial<Settings>): void => {
    setSettings((s) => ({ ...s, ...p }))
    setTestResult(null)
  }

  const saveAndTest = async (): Promise<void> => {
    await api.setSettings(settings)
    setTesting(true)
    setTestResult(null)
    try {
      setTestResult(await api.testProvider())
    } finally {
      setTesting(false)
    }
  }

  const finish = async (): Promise<void> => {
    await api.setSettings({ ...settings, onboarded: true, paused: false })
    onDone()
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`progress-dot ${i <= step ? 'done' : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <h1>Welcome to DearDiary</h1>
            <p className="lead">
              DearDiary writes your work journal for you. It quietly records your screen while
              you work, and AI turns that into a timeline you can summarize, search, and turn
              into standup updates.
            </p>
            <div className="onboarding-points">
              <div className="point">
                <ShieldIcon size={22} />
                <div>
                  <strong>Private by design.</strong> Screenshots and your journal are stored
                  only on this PC. Raw screenshots are deleted after 7 days.
                </div>
              </div>
              <div className="point">
                <TimelineIcon size={22} />
                <div>
                  <strong>Nothing is recorded yet.</strong> Recording starts only after you
                  finish this setup, and you can pause it any time from the tray.
                </div>
              </div>
              <div className="point">
                <ChatIcon size={22} />
                <div>
                  <strong>14-day free trial.</strong> Full features, no account. After the
                  trial, a one-time or annual license keeps recording going — your history is
                  yours forever either way.
                </div>
              </div>
            </div>
            <div className="onboarding-actions">
              <button className="btn" onClick={() => setStep(1)}>
                Get started
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Choose your AI</h1>
            <p className="lead">
              Screenshots are analyzed by an AI provider you control. Gemini's free tier is the
              easiest start; Ollama keeps everything on your machine.
            </p>
            <ProviderForm settings={settings} onChange={patch} />
            <div className="row gap">
              <button className="btn ghost" onClick={() => void saveAndTest()} disabled={testing}>
                {testing ? 'Testing…' : 'Test connection'}
              </button>
            </div>
            {testResult && (
              <div className={`banner ${testResult.ok ? 'ok' : 'warn'}`}>{testResult.message}</div>
            )}
            <div className="onboarding-actions">
              <button className="btn ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await api.setSettings(settings)
                  setStep(2)
                }}
              >
                {testResult?.ok ? 'Continue' : 'Continue (set up later in Settings)'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>How recording works</h1>
            <ul className="onboarding-list">
              <li>
                A screenshot of your primary display is taken every{' '}
                <strong>{settings.captureIntervalSec} seconds</strong> while you're active.
              </li>
              <li>Capture pauses automatically when you step away or lock your screen.</li>
              <li>
                Every ~{settings.batchMinutes} minutes, a batch is analyzed and your timeline
                grows — your first cards appear within about {settings.batchMinutes} minutes.
              </li>
              <li>
                DearDiary lives in the system tray. Closing the window keeps it recording;
                pause or quit from the tray icon.
              </li>
            </ul>
            <p className="lead">
              Then the payoff: a written <strong>journal</strong> of each day, one-click{' '}
              <strong>standup updates</strong>, and a <strong>chat</strong> that answers
              questions about your own time.
            </p>
            <div className="onboarding-actions">
              <button className="btn ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn" onClick={() => void finish()}>
                Start recording
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
