import { useEffect, useRef, useState } from 'react'
import PhotoImg from '../components/PhotoImg'

interface GuestForm { name: string; phone: string; age: string; sex: string; photoPath: string | null; skipped: boolean }
interface Room { id: number; room_number: string; room_type: string; floor: number; price_per_night: number }
type WizardStep = 'party-size' | 'guest' | 'document' | 'rooms' | 'confirm'
const blank = (): GuestForm => ({ name: '', phone: '', age: '', sex: '', photoPath: null, skipped: false })

/* ── Camera Modal ───────────────────────────────────────────────────────────── */
function CameraModal({ onCapture, onClose, prefix = 'photo' }: { onCapture: (p: string) => void; onClose: () => void; prefix?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [captured, setCaptured] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const startCam = () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(s => { streamRef.current = s; if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play() } })
      .catch(e => setErr('Camera unavailable: ' + e.message))
  }

  useEffect(() => { startCam(); return () => streamRef.current?.getTracks().forEach(t => t.stop()) }, [])

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return
    const c = canvasRef.current, v = videoRef.current
    c.width = v.videoWidth; c.height = v.videoHeight
    c.getContext('2d')?.drawImage(v, 0, 0)
    setCaptured(c.toDataURL('image/jpeg', 0.88))
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  const retake = () => { setCaptured(null); startCam() }

  const confirm = async () => {
    if (!captured) return
    const path = await window.api.photo.save({ dataUrl: captured, prefix })
    onCapture(path); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal camera-modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>{captured ? 'Preview' : '📷 Camera'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {err ? <div className="alert alert-error">{err}</div> : null}
        {!captured
          ? <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
          : <img src={captured} className="camera-preview" alt="preview" />}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="camera-actions">
          {!captured
            ? <><button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <div className="capture-btn" onClick={capture}>📷</div></>
            : <><button className="btn btn-ghost" onClick={retake}>↺ Retake</button>
                <button className="btn btn-primary" onClick={confirm}>✓ Use Photo</button></>
          }
        </div>
      </div>
    </div>
  )
}

/* ── Photo Widget ───────────────────────────────────────────────────────────── */
function PhotoWidget({ value, onChange, prefix = 'photo' }: { value: string | null; onChange: (p: string | null) => void; prefix?: string }) {
  const [showCam, setShowCam] = useState(false)
  const browse = async () => { const p = await window.api.dialog.pickImage(); if (p) onChange(p) }
  return (
    <div className="photo-btn-wrap">
      <div className="photo-thumb" onClick={() => setShowCam(true)}>
        {value
          ? <PhotoImg src={value} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : '👤'}
      </div>
      <div className="photo-actions-row">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCam(true)}>📷 Camera</button>
        <button className="btn btn-ghost btn-sm" onClick={browse}>🗂 Browse</button>
        {value && <button className="btn btn-danger btn-sm" onClick={() => onChange(null)}>✕</button>}
      </div>
      {showCam && <CameraModal onCapture={onChange} onClose={() => setShowCam(false)} prefix={prefix} />}
    </div>
  )
}

/* ── Step bar ───────────────────────────────────────────────────────────────── */
function StepBar({ step, partySize, guestIdx }: { step: WizardStep; partySize: number; guestIdx: number }) {
  const steps = [
    { id: 'party-size', label: 'Party Size' },
    { id: 'guest',      label: partySize > 0 ? `Guests (${Math.min(guestIdx+1,partySize)}/${partySize})` : 'Guests' },
    { id: 'document',   label: 'Document' },
    { id: 'rooms',      label: 'Rooms' },
    { id: 'confirm',    label: 'Confirm' },
  ]
  const order = ['party-size','guest','document','rooms','confirm']
  const cur = order.indexOf(step)
  return (
    <div className="wizard-steps">
      {steps.map((s, i) => (
        <>
          <div key={s.id} className={`wstep ${i===cur?'active':''} ${i<cur?'done':''}`}>
            <div className="wstep-dot">{i < cur ? '✓' : i+1}</div>
            <span style={{ fontSize: 11 }}>{s.label}</span>
          </div>
          {i < steps.length-1 && <div key={`l${i}`} className={`wstep-line ${i<cur?'done':''}`} />}
        </>
      ))}
    </div>
  )
}

/* ── Main ───────────────────────────────────────────────────────────────────── */
export default function CheckInPage({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<WizardStep>('party-size')
  const [partySize, setPartySize] = useState(0)
  const [customSize, setCustomSize] = useState('')
  const [guestIdx, setGuestIdx] = useState(0)
  const [guests, setGuests] = useState<GuestForm[]>([])
  const [documentPath, setDocumentPath] = useState<string | null>(null)
  const [showDocCam, setShowDocCam] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedRooms, setSelectedRooms] = useState<number[]>([])
  const [nights, setNights] = useState('1')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { if (step === 'rooms') window.api.rooms.available().then(setRooms) }, [step])

  const checkOutDate = () => {
    const d = new Date(); d.setDate(d.getDate() + (parseInt(nights) || 1))
    return d.toISOString().slice(0, 10)
  }

  const startWizard = (n: number) => {
    setPartySize(n); setGuests(Array.from({ length: n }, blank)); setGuestIdx(0); setStep('guest')
  }

  const g = guests[guestIdx]
  const setG = (f: keyof GuestForm, v: any) =>
    setGuests(prev => prev.map((x, i) => i === guestIdx ? { ...x, [f]: v } : x))

  const nextGuest = (skip = false) => {
    if (skip) setGuests(prev => prev.map((x, i) => i === guestIdx ? { ...x, skipped: true } : x))
    guestIdx < partySize - 1 ? setGuestIdx(guestIdx + 1) : setStep('document')
  }

  const skipAll = () => {
    setGuests(prev => prev.map((x, i) => i >= guestIdx ? { ...x, skipped: true } : x))
    setStep('document')
  }

  const prevStep = () => {
    if (step === 'guest') { guestIdx > 0 ? setGuestIdx(guestIdx-1) : setStep('party-size') }
    else if (step === 'document') { setGuestIdx(partySize-1); setStep('guest') }
    else if (step === 'rooms') setStep('document')
    else if (step === 'confirm') setStep('rooms')
  }

  const submit = async () => {
    setError(''); setSaving(true)
    const res = await window.api.checkin.submit({
      guests: guests.map((x, i) => ({
        name: x.name.trim() || `Guest ${i+1}`,
        phone: x.phone.trim() || undefined,
        age: x.age ? parseInt(x.age) : undefined,
        sex: x.sex || undefined,
        photo_path: x.photoPath || undefined,
        is_primary: i === 0
      })),
      room_ids: selectedRooms,
      check_out_date: checkOutDate(),
      document_path: documentPath || undefined,
      notes: notes.trim() || undefined
    })
    setSaving(false)
    if (res?.error) { setError(res.error); return }
    setSuccess(`✓ Checked in! Ref: ${res.booking_reference}`)
    setTimeout(onDone, 2000)
  }

  /* Party Size */
  if (step === 'party-size') return (
    <div className="wizard-wrap">
      <StepBar step={step} partySize={0} guestIdx={0} />
      <div className="card card-pad fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>How many guests?</h2>
          <p style={{ color: 'var(--text-mute)', fontSize: 13 }}>Select or enter the number of people checking in</p>
        </div>
        <div className="party-grid">
          {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
            <button key={n} className={`party-btn ${partySize===n?'selected':''}`} onClick={() => setPartySize(n)}>{n}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-mute)', fontWeight: 600 }}>or custom</span>
          <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="form-input" type="number" min="1" max="99" placeholder="Enter number…"
            value={customSize} onChange={e => { setCustomSize(e.target.value); setPartySize(0) }}
            style={{ maxWidth: 160 }} />
          {customSize && parseInt(customSize) > 0 &&
            <button className="btn btn-ghost" onClick={() => setPartySize(parseInt(customSize))}>Select {customSize}</button>}
        </div>
        {partySize > 0 && <div className="alert alert-info">{partySize} guest{partySize>1?'s':''} selected</div>}
        <div className="wizard-nav" style={{ marginTop: 'auto' }}>
          <button className="btn btn-ghost" onClick={onDone}>✕ Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!partySize && !parseInt(customSize)}
            onClick={() => startWizard(partySize || parseInt(customSize))}>
            Next → Guest Details
          </button>
        </div>
      </div>
    </div>
  )

  /* Guest form */
  if (step === 'guest' && g) {
    const remaining = partySize - guestIdx - 1
    return (
      <div className="wizard-wrap">
        <StepBar step={step} partySize={partySize} guestIdx={guestIdx} />
        <div className="card card-pad fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 3 }}>
                Guest {guestIdx+1} of {partySize}
                {guestIdx===0 && <span style={{ background:'var(--accent)', color:'#fff', fontSize:10, fontWeight:700, borderRadius:4, padding:'2px 7px', marginLeft:8, verticalAlign:'middle' }}>PRIMARY</span>}
              </h2>
              <p style={{ color: 'var(--text-mute)', fontSize: 12 }}>All fields optional — fill what's available</p>
            </div>
            <div className="guest-dots">
              {guests.map((x, i) => <div key={i} className={`guest-dot ${i===guestIdx?'current':x.name||x.photoPath?'done':x.skipped?'skipped':''}`} />)}
            </div>
          </div>

          <div className="guest-form-layout">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Photo</span>
              <PhotoWidget value={g.photoPath} onChange={p => setG('photoPath', p)} prefix={`guest${guestIdx+1}`} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={g.name} onChange={e => setG('name', e.target.value)} placeholder="Leave blank to skip…" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input className="form-input" type="tel" value={g.phone} onChange={e => setG('phone', e.target.value)} placeholder="+91 9876543210" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Age</label>
                  <input className="form-input" type="number" min="1" max="120" value={g.age} onChange={e => setG('age', e.target.value)} placeholder="—" />
                </div>
                <div className="form-group">
                  <label className="form-label">Sex</label>
                  <select className="form-select" value={g.sex} onChange={e => setG('sex', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="wizard-nav">
            <button className="btn btn-ghost" onClick={prevStep}>← Back</button>
            <div className="wizard-nav-right">
              {remaining > 0 && <button className="btn btn-ghost btn-sm" onClick={skipAll}>Skip All ({remaining} left)</button>}
              <button className="btn btn-ghost" onClick={() => nextGuest(true)}>Skip →</button>
              <button className="btn btn-primary" onClick={() => nextGuest(false)}>
                {guestIdx < partySize-1 ? 'Next Guest →' : 'Next: Document →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* Document */
  if (step === 'document') return (
    <div className="wizard-wrap">
      <StepBar step={step} partySize={partySize} guestIdx={guestIdx} />
      <div className="card card-pad fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Group ID Document</h2>
          <p style={{ color: 'var(--text-mute)', fontSize: 13 }}>Capture or attach the group's ID proof (passport, Aadhaar, licence…)</p>
        </div>

        <div className="doc-upload-area" style={{ cursor: 'pointer' }} onClick={() => setShowDocCam(true)}>
          {documentPath
            ? <PhotoImg src={documentPath} style={{ width:'100%', maxHeight:260, objectFit:'contain', borderRadius:8 }} />
            : <><span style={{ fontSize: 42, opacity: 0.4 }}>🪪</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Click to capture or attach</span>
                <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>JPG, PNG, WEBP supported</span></>
          }
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowDocCam(true)}>📷 Camera</button>
          <button className="btn btn-ghost" onClick={async () => { const p = await window.api.dialog.pickImage(); if (p) setDocumentPath(p) }}>🗂 Browse File</button>
          {documentPath && <><span className="badge badge-green">✓ Attached</span>
            <button className="btn btn-danger btn-sm" onClick={() => setDocumentPath(null)}>Remove</button></>}
        </div>

        {showDocCam && <CameraModal onCapture={p => { setDocumentPath(p); setShowDocCam(false) }} onClose={() => setShowDocCam(false)} prefix="doc" />}

        <div className="wizard-nav">
          <button className="btn btn-ghost" onClick={prevStep}>← Back</button>
          <button className="btn btn-primary" onClick={() => setStep('rooms')}>Next: Room Selection →</button>
        </div>
      </div>
    </div>
  )

  /* Rooms */
  if (step === 'rooms') return (
    <div className="wizard-wrap">
      <StepBar step={step} partySize={partySize} guestIdx={guestIdx} />
      <div className="card card-pad fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Select Room(s)</h2>
            <p style={{ color: 'var(--text-mute)', fontSize: 13 }}>{selectedRooms.length ? `${selectedRooms.length} selected` : 'Pick one or more available rooms'}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Number of Nights</label>
              <input className="form-input" type="number" min="1" max="365" value={nights}
                onChange={e => setNights(e.target.value)} style={{ width: 110 }} />
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--text-mute)', fontWeight: 600 }}>CHECK-OUT</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', fontFamily: 'JetBrains Mono' }}>{checkOutDate()}</div>
            </div>
          </div>
        </div>

        {!rooms.length
          ? <div className="empty-state"><span className="empty-icon">🏠</span>No available rooms. Add rooms in the Rooms tab.</div>
          : <div className="room-grid">
              {rooms.map(r => {
                const sel = selectedRooms.includes(r.id)
                return (
                  <div key={r.id} className={`room-card ${sel?'selected':''}`} onClick={() => setSelectedRooms(prev => prev.includes(r.id) ? prev.filter(x=>x!==r.id) : [...prev, r.id])} style={{ position: 'relative' }}>
                    {sel && <div className="room-card-check">✓</div>}
                    <div className="room-card-num">Room {r.room_number}</div>
                    <div className="room-card-type">{r.room_type} · Floor {r.floor}</div>
                    <div className="room-card-price">₹{Number(r.price_per_night).toLocaleString('en-IN')}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-mute)', fontFamily: 'Inter' }}>/night</span></div>
                  </div>
                )
              })}
            </div>
        }

        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requests, extra bed…" style={{ minHeight: 56 }} />
        </div>

        <div className="wizard-nav">
          <button className="btn btn-ghost" onClick={prevStep}>← Back</button>
          <button className="btn btn-primary" disabled={!selectedRooms.length} onClick={() => setStep('confirm')}>Review & Confirm →</button>
        </div>
      </div>
    </div>
  )

  /* Confirm */
  if (step === 'confirm') return (
    <div className="wizard-wrap">
      <StepBar step={step} partySize={partySize} guestIdx={guestIdx} />
      <div className="card card-pad fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Review & Confirm</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="confirm-section">
          <div className="confirm-label">Guests ({partySize})</div>
          {guests.map((x, i) => (
            <div key={i} className="confirm-guest-card">
              <div className="confirm-guest-avatar">
                {x.photoPath
                  ? <PhotoImg src={x.photoPath} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} />
                  : '👤'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {x.name || `Guest ${i+1}`}
                  {i === 0 && <span style={{ marginLeft: 8, fontSize: 9, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>PRIMARY</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 2 }}>
                  {[x.phone, x.age&&`Age ${x.age}`, x.sex].filter(Boolean).join(' · ') || 'No details'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {documentPath && (
          <div className="confirm-section">
            <div className="confirm-label">Document</div>
            <PhotoImg src={documentPath} style={{ maxHeight: 90, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'contain', background: 'var(--bg-elevated)', display:'block' }} />
          </div>
        )}

        <div className="confirm-section">
          <div className="confirm-label">Rooms & Stay</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedRooms.map(id => { const r = rooms.find(x=>x.id===id); return r ? (
              <div key={id} style={{ background:'var(--accent-dim)', border:'1px solid var(--border-hi)', borderRadius:8, padding:'8px 14px' }}>
                <div style={{ fontWeight:900, color:'var(--accent)' }}>Room {r.room_number}</div>
                <div style={{ fontSize:11, color:'var(--text-mute)' }}>{r.room_type}</div>
              </div>
            ) : null})}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-sec)', marginTop: 6 }}>
            <strong>{parseInt(nights)||1}</strong> night{parseInt(nights)!==1?'s':''} · Check-out <strong>{checkOutDate()}</strong>
          </div>
          {notes && <div style={{ fontSize: 12, color: 'var(--text-mute)', marginTop: 4 }}>Note: {notes}</div>}
        </div>

        <div className="wizard-nav">
          <button className="btn btn-ghost" onClick={prevStep} disabled={saving}>← Back</button>
          <button className="btn btn-primary btn-lg" onClick={submit} disabled={saving || !!success}>
            {saving ? <><div className="spinner" style={{ width:16, height:16, borderWidth:2 }} /> Processing…</> : '✓ Confirm Check-In'}
          </button>
        </div>
      </div>
    </div>
  )

  return <div />
}
