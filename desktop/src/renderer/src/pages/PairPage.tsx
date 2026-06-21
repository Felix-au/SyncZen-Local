import { useEffect, useRef, useState } from 'react'

interface ServerInfo {
  ip: string; port: number; url: string; token: string; qr: string
}

/** Copies text — falls back to execCommand for file:// Electron contexts */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
    document.body.appendChild(el)
    el.focus(); el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

export default function PairPage(): JSX.Element {
  const [info, setInfo] = useState<ServerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [regen, setRegen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async (): Promise<void> => {
    setLoading(true)
    try { setInfo(await window.api.server.info()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const copy = (field: string, value: string) => {
    copyText(value)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setCopiedField(field)
    copyTimer.current = setTimeout(() => setCopiedField(null), 2000)
  }

  const handleRegen = async (): Promise<void> => {
    if (!confirm('Regenerate pairing token? All paired mobile devices will need to re-scan the QR code.')) return
    setRegen(true)
    await window.api.server.regenerateToken()
    await load()
    setRegen(false)
  }

  const CopyBtn = ({ field, value }: { field: string; value: string }) => (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => copy(field, value)}
      style={{ minWidth: 74, flexShrink: 0 }}
    >
      {copiedField === field ? '✓ Copied' : '⎘ Copy'}
    </button>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Device Pairing</h1>
          <p className="page-sub">Scan the QR code from the SyncZen Local mobile app</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
          <button className="btn btn-danger btn-sm" onClick={handleRegen} disabled={regen}>
            {regen ? 'Regenerating…' : '⚠ Regenerate Token'}
          </button>
        </div>
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
        : info && (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>

            {/* QR Code */}
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{
                padding: 14, background: '#0D1B2E',
                borderRadius: 14, border: '2px solid var(--accent)',
                boxShadow: '0 0 40px var(--accent-glow)'
              }}>
                <img src={info.qr} alt="Pairing QR Code" style={{ width: 220, height: 220, display: 'block', borderRadius: 4 }} />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-mute)', textAlign: 'center', maxWidth: 220, lineHeight: 1.6 }}>
                Open SyncZen Local on your Android device and scan this code
              </p>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Connection info */}
              <div className="card card-pad">
                <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Connection Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Server URL', field: 'url',   value: info.url },
                    { label: 'Local IP',   field: 'ip',    value: info.ip },
                    { label: 'Port',       field: 'port',  value: String(info.port) },
                  ].map(({ label, field, value }) => (
                    <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-mute)', fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase' }}>{label}</span>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: 'var(--bg-surface)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '8px 12px'
                      }}>
                        <code style={{ flex: 1, color: 'var(--accent)', fontSize: 13, fontFamily: 'JetBrains Mono' }}>{value}</code>
                        <CopyBtn field={field} value={value} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Token */}
              <div className="card card-pad">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ fontWeight: 700 }}>Pairing Token</h3>
                  <CopyBtn field="token" value={info.token} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 14, lineHeight: 1.6 }}>
                  This token is embedded in the QR code. It ensures only your devices can connect.
                  It is generated once and persists unless you regenerate it.
                </p>
                <div style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px'
                }}>
                  <code style={{ color: 'var(--text-sec)', fontSize: 12, wordBreak: 'break-all', fontFamily: 'JetBrains Mono' }}>
                    {info.token}
                  </code>
                </div>
              </div>

              {/* Server status */}
              <div className="card card-pad">
                <h3 style={{ fontWeight: 700, marginBottom: 14 }}>Server Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'API Server', value: `Running on port ${info.port}`, ok: true },
                    { label: 'Listening',  value: '0.0.0.0 (all network interfaces)', ok: true },
                    { label: 'Auth',       value: 'Bearer token required for all endpoints', ok: true },
                  ].map(({ label, value, ok }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: ok ? 'var(--green)' : 'var(--red)',
                        boxShadow: ok ? '0 0 8px var(--green)' : 'none',
                        flexShrink: 0
                      }} />
                      <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>
                        <strong style={{ color: 'var(--text-pri)' }}>{label}:</strong> {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
    </>
  )
}
