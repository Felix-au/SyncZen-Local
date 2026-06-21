import { useEffect, useRef, useState } from 'react'
import logoUrl from '../assets/logo.png'

type Step = { label: string; status: 'waiting' | 'running' | 'done' | 'error'; detail?: string }

const STEPS = [
  'Initializing database',
  'Adding firewall rule for port 8080',
  'Generating pairing token',
  'Starting API server',
]

export default function SetupPage({ onDone }: { onDone: () => void }): JSX.Element {
  const [steps, setSteps] = useState<Step[]>(STEPS.map((label) => ({ label, status: 'waiting' })))
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const unsub = window.api.setup.onProgress(({ step, status, detail }) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.label === step ? { ...s, status, detail } : s
        )
      )
    })

    window.api.setup.run().then((res) => {
      if (res.success) {
        setDone(true)
        setTimeout(onDone, 1200)
      } else {
        setError(res.error ?? 'Setup failed')
      }
      unsub()
    })
  }, [])

  const statusIcon = (s: Step['status']): JSX.Element => {
    if (s === 'waiting') return <span style={{ color: 'var(--text-mute)' }}>○</span>
    if (s === 'running') return <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
    if (s === 'done')    return <span style={{ color: 'var(--green)' }}>✓</span>
    return <span style={{ color: 'var(--red)' }}>✕</span>
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo + Title */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <img src={logoUrl} alt="SyncZen Local" style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 16 }} />
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-pri)' }}>Welcome to SyncZen Local</h1>
          <p style={{ color: 'var(--text-mute)', fontSize: 14, marginTop: 6 }}>
            {done ? 'All done! Launching…' : 'Setting up your hotel management system…'}
          </p>
        </div>

        {/* Steps */}
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 0',
              borderBottom: i < steps.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                {statusIcon(step.status)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  color: step.status === 'waiting' ? 'var(--text-mute)' : 'var(--text-pri)'
                }}>{step.label}</div>
                {step.detail && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 3 }}>{step.detail}</div>}
              </div>
              {step.status === 'done' && (
                <span className="badge badge-green" style={{ fontSize: 10 }}>Done</span>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {done && (
          <div className="alert alert-success" style={{ marginTop: 16, textAlign: 'center' }}>
            ✓ Setup complete! Loading dashboard…
          </div>
        )}
      </div>
    </div>
  )
}
