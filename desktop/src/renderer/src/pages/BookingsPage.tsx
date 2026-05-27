import { useEffect, useState } from 'react'
import PhotoImg from '../components/PhotoImg'

interface Booking {
  id: number; booking_reference: string; check_in_time: string
  check_out_date: string; status: string; notes?: string
  rooms?: string; guests?: string; id_proof_path?: string
}

interface BookingDetail {
  booking: Booking & { id_proof_path?: string }
  guests: { id: number; name: string; phone?: string; age?: number; sex?: string; photo_path?: string; is_primary_contact: number }[]
  rooms: { id: number; room_number: string; room_type: string; floor: number; price_per_night: number }[]
}

const STATUS_BADGE: Record<string, string> = {
  checked_in: 'badge-green', checked_out: 'badge-navy', cancelled: 'badge-red'
}

function DetailModal({ id, onClose, onCheckout }: { id: number; onClose: () => void; onCheckout: () => void }) {
  const [detail, setDetail] = useState<BookingDetail | null>(null)
  const [checkouting, setCheckouting] = useState(false)

  useEffect(() => {
    window.api.bookings.detail(id).then(setDetail)
  }, [id])

  const handleCheckout = async () => {
    if (!detail) return
    if (!confirm(`Check out ${detail.booking.booking_reference}? Rooms will be freed.`)) return
    setCheckouting(true)
    await window.api.bookings.checkout(id)
    setCheckouting(false)
    onCheckout()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg detail-modal" style={{ maxWidth: 740 }}>
        {!detail
          ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
          : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-mute)', marginBottom: 4 }}>Booking Reference</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent)', fontFamily: 'JetBrains Mono', letterSpacing: -0.5 }}>
                    {detail.booking.booking_reference}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge ${STATUS_BADGE[detail.booking.status] ?? 'badge-navy'}`} style={{ fontSize: 12 }}>
                    {detail.booking.status.replace('_', ' ')}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>
              </div>

              {/* Stay info */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  {[
                    { k: 'Check-In', v: detail.booking.check_in_time?.slice(0, 16).replace('T', ' ') },
                    { k: 'Check-Out', v: detail.booking.check_out_date },
                    { k: 'Rooms', v: detail.rooms.map(r => r.room_number).join(', ') || '—' },
                    { k: 'Guests', v: String(detail.guests.length) },
                  ].map(({ k, v }) => (
                    <div key={k}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-pri)' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
              {detail.booking.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 16, fontStyle: 'italic' }}>
                  Note: {detail.booking.notes}
                </div>
              )}

              {/* Guests */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                Guests ({detail.guests.length})
              </div>
              <div className="detail-guest-grid" style={{ marginBottom: 16 }}>
                {detail.guests.map((g) => (
                  <div key={g.id} className="detail-guest-card">
                    <div className="detail-guest-photo">
                      {g.photo_path
                        ? <PhotoImg src={g.photo_path} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : '👤'
                      }
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{g.name || '—'}</div>
                        {g.is_primary_contact === 1 && (
                          <span style={{ fontSize: 9, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>PRIMARY</span>
                        )}
                      </div>
                      {[
                        { label: 'Phone', value: g.phone },
                        { label: 'Age',   value: g.age },
                        { label: 'Sex',   value: g.sex },
                      ].filter(f => f.value).map(({ label, value }) => (
                        <div key={label} className="detail-field">
                          <div className="detail-field-label">{label}</div>
                          <div className="detail-field-value">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Document */}
              {detail.booking.id_proof_path && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                    ID Document
                  </div>
                  <PhotoImg
                    src={detail.booking.id_proof_path}
                    style={{ width:'100%', maxHeight:200, borderRadius:8, objectFit:'contain', background:'var(--bg-elevated)', border:'1px solid var(--border)', display:'block', marginBottom:16 }}
                  />
                </>
              )}

              {/* Rooms */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                Room Allocation
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {detail.rooms.map((r) => (
                  <div key={r.id} style={{ background: 'var(--accent-dim)', border: '1px solid var(--border-hi)', borderRadius: 10, padding: '10px 16px' }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--accent)' }}>Room {r.room_number}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{r.room_type} · Floor {r.floor}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                      ₹{Number(r.price_per_night).toLocaleString('en-IN')}/night
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={onClose}>Close</button>
                {detail.booking.status === 'checked_in' && (
                  <button className="btn btn-danger" onClick={handleCheckout} disabled={checkouting}>
                    {checkouting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Checking out…</> : '🚪 Check Out'}
                  </button>
                )}
              </div>
            </>
          )}
      </div>
    </div>
  )
}

export default function BookingsPage(): JSX.Element {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [error, setError]       = useState('')
  const [detailId, setDetailId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await window.api.bookings.list()
      setBookings(data); setError('')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-sub">{bookings.filter(b => b.status === 'checked_in').length} active · {bookings.length} total</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', 'checked_in', 'checked_out', 'cancelled'].map((f) => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(f)} style={{ textTransform: 'capitalize' }}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        : (
          <div className="card">
            <div className="table-wrap">
              {!filtered.length
                ? <div className="empty-state"><span className="empty-icon">📋</span>No bookings found.</div>
                : (
                  <table>
                    <thead>
                      <tr>
                        <th>Reference</th><th>Guests</th><th>Rooms</th>
                        <th>Check-In</th><th>Check-Out</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((b) => (
                        <tr key={b.id} className="clickable" onClick={() => setDetailId(b.id)} title="Click to view details">
                          <td><code style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'JetBrains Mono' }}>{b.booking_reference}</code></td>
                          <td style={{ fontWeight: 600, maxWidth: 200 }}>{b.guests ?? '—'}</td>
                          <td style={{ color: 'var(--text-sec)' }}>{b.rooms ?? '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--text-sec)', whiteSpace: 'nowrap' }}>
                            {b.check_in_time?.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-sec)' }}>{b.check_out_date}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[b.status] ?? 'badge-navy'}`}>
                              {b.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
            {filtered.length > 0 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-mute)' }}>
                Click any row to view full booking details
              </div>
            )}
          </div>
        )}

      {detailId !== null && (
        <DetailModal
          id={detailId}
          onClose={() => setDetailId(null)}
          onCheckout={load}
        />
      )}
    </>
  )
}
