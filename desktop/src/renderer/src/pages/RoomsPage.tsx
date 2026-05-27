import { useEffect, useState } from 'react'

interface Room {
  id: number; room_number: string; room_type: string; floor: number
  status: string; price_per_night: number; notes?: string
  booking_reference?: string; check_out_date?: string; guest_names?: string
}

const STATUS_OPTIONS = ['available', 'occupied', 'maintenance', 'checkout']
const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Executive', 'Family', 'Presidential']

export default function RoomsPage(): JSX.Element {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ room_number: '', room_type: 'Standard', floor: '1', price_per_night: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      const data = await window.api.rooms.list()
      setRooms(data)
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async (): Promise<void> => {
    if (!form.room_number.trim()) { setFormError('Room number is required'); return }
    setSaving(true); setFormError('')
    const res = await window.api.rooms.add({
      room_number: form.room_number.trim(),
      room_type: form.room_type,
      floor: parseInt(form.floor) || 1,
      price_per_night: parseFloat(form.price_per_night) || 0,
      notes: form.notes.trim() || undefined
    })
    setSaving(false)
    if (res?.error) { setFormError(res.error); return }
    setShowAdd(false)
    setForm({ room_number: '', room_type: 'Standard', floor: '1', price_per_night: '', notes: '' })
    load()
  }

  const handleStatusChange = async (id: number, status: string): Promise<void> => {
    await window.api.rooms.updateStatus(id, status)
    load()
  }

  const handleDelete = async (id: number, room_number: string): Promise<void> => {
    if (!confirm(`Delete room ${room_number}?`)) return
    const res = await window.api.rooms.delete(id)
    if (res?.error) alert(res.error)
    else load()
  }

  const filtered = filter === 'all' ? rooms : rooms.filter((r) => r.status === filter)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rooms</h1>
          <p className="page-sub">{rooms.length} rooms total · {rooms.filter(r => r.status === 'available').length} available</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>✚ Add Room</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['all', ...STATUS_OPTIONS].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(s)} style={{ textTransform: 'capitalize' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading
        ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        : (
          <div className="card">
            <div className="table-wrap">
              {!filtered.length
                ? <div className="empty-state"><div className="empty-icon">🏠</div>No rooms found.</div>
                : (
                  <table>
                    <thead>
                      <tr>
                        <th>Room</th><th>Type</th><th>Floor</th>
                        <th>Price/Night</th><th>Status</th><th>Guest</th><th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 700, fontSize: 15 }}>{r.room_number}</td>
                          <td style={{ color: 'var(--text-sec)' }}>{r.room_type}</td>
                          <td style={{ color: 'var(--text-sec)' }}>{r.floor}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent)' }}>
                            ₹{Number(r.price_per_night).toLocaleString('en-IN')}
                          </td>
                          <td>
                            <select
                              value={r.status}
                              onChange={(e) => handleStatusChange(r.id, e.target.value)}
                              style={{
                                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                borderRadius: 6, padding: '4px 8px', color: 'var(--text-pri)',
                                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit'
                              }}
                            >
                              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                            {r.guest_names
                              ? <><div style={{ fontWeight: 600, color: 'var(--text-pri)' }}>{r.guest_names}</div>
                                  <div style={{ color: 'var(--text-mute)' }}>out: {r.check_out_date}</div></>
                              : <span style={{ color: 'var(--text-mute)' }}>—</span>
                            }
                          </td>
                          <td>
                            <button className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(r.id, r.room_number)}
                              disabled={r.status === 'occupied'}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
            </div>
          </div>
        )}

      {/* Add Room Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <h2 className="modal-title">Add New Room</h2>
            {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input className="form-input" value={form.room_number}
                    onChange={(e) => setForm({ ...form, room_number: e.target.value })}
                    placeholder="e.g. 101" />
                </div>
                <div className="form-group">
                  <label className="form-label">Floor</label>
                  <input className="form-input" type="number" value={form.floor}
                    onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Room Type</label>
                  <select className="form-select" value={form.room_type}
                    onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
                    {ROOM_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Price per Night (₹)</label>
                  <input className="form-input" type="number" value={form.price_per_night}
                    onChange={(e) => setForm({ ...form, price_per_night: e.target.value })}
                    placeholder="0" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Special features, amenities…" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
                {saving ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</> : 'Add Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
