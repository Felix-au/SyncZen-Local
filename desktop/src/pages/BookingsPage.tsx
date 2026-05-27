import { useEffect, useState } from 'react'

const API = 'http://localhost:8080'

interface Booking {
  id: number
  booking_reference: string
  check_in_time: string
  check_out_date: string
  status: 'checked_in' | 'checked_out' | 'cancelled'
  guest_names: string
  guest_count: number
  rooms: string
}

interface DetailedBooking {
  booking: Booking & { id_proof_path?: string | null; notes?: string | null }
  guests: Array<{
    id: number
    name: string
    age?: number | null
    sex?: string | null
    photo_path?: string | null
    is_primary_contact: boolean
  }>
  rooms: Array<{
    id: number
    room_number: string
    room_type: string
    floor: number
    price_per_night: number
  }>
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('checked_in')

  // Detailed Modal State
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [details, setDetails]       = useState<DetailedBooking | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [errorDetails, setErrorDetails]     = useState('')
  const [zoomImage, setZoomImage]           = useState<string | null>(null)

  const fetchBookings = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : ''
      const res  = await fetch(`${API}/api/bookings${params}`)
      const data = await res.json()
      setBookings(data.bookings ?? [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchBookings() }, [filter])

  // Fetch Booking Details on select
  useEffect(() => {
    if (selectedId === null) {
      setDetails(null)
      return
    }
    const fetchDetails = async () => {
      setLoadingDetails(true)
      setErrorDetails('')
      try {
        const res = await fetch(`${API}/api/bookings/${selectedId}`)
        if (!res.ok) throw new Error('Failed to load booking details.')
        const data = await res.json()
        setDetails(data)
      } catch (err: any) {
        setErrorDetails(err.message ?? 'An error occurred.')
      } finally {
        setLoadingDetails(false)
      }
    }
    fetchDetails()
  }, [selectedId])

  const checkout = async (id: number) => {
    if (!confirm('Confirm guest checkout?')) return
    await fetch(`${API}/api/bookings/${id}/checkout`, { method: 'POST' })
    fetchBookings()
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = (d: string) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bookings-page animate-fade">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-sub">{bookings.length} records · {filter === 'checked_in' ? 'Active' : filter === 'checked_out' ? 'Checked Out' : 'All'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['checked_in','checked_out','all'].map(s => (
            <button key={s} className={`filter-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s === 'checked_in' ? 'Active' : s === 'checked_out' ? 'Checked Out' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading
        ? <div className="loading-state"><span className="animate-spin">⟳</span> Loading...</div>
        : (
          <div className="booking-list">
            {bookings.map(b => (
              <div
                key={b.id}
                className="booking-row glass-card clickable-row"
                onClick={() => setSelectedId(b.id)}
              >
                <div className="booking-ref">
                  <span className="ref-code">{b.booking_reference}</span>
                  <span className={`badge ${b.status === 'checked_in' ? 'badge-green' : b.status === 'checked_out' ? 'badge-accent' : 'badge-red'}`}>
                    {b.status === 'checked_in' ? 'Active' : b.status === 'checked_out' ? 'Checked Out' : 'Cancelled'}
                  </span>
                </div>
                <div className="booking-meta">
                  <span>👥 {b.guest_count} guest{b.guest_count !== 1 ? 's' : ''}</span>
                  <span>🏨 Rooms: {b.rooms || '—'}</span>
                  <span>📅 In: {fmtTime(b.check_in_time)}</span>
                  <span>📅 Out: {fmtDate(b.check_out_date)}</span>
                </div>
                <div className="booking-guests">{b.guest_names}</div>
                <div className="booking-actions">
                  {b.status === 'checked_in' && (
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '12px', padding: '7px 14px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        checkout(b.id)
                      }}
                    >
                      Check Out
                    </button>
                  )}
                </div>
              </div>
            ))}
            {bookings.length === 0 && (
              <div className="empty-state">No bookings found. Use the mobile app to check in guests.</div>
            )}
          </div>
        )
      }

      {/* Booking Details Modal */}
      {selectedId !== null && (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            {loadingDetails && (
              <div className="modal-loading">
                <span className="animate-spin">⟳</span> Fetching booking details...
              </div>
            )}
            {errorDetails && (
              <div className="modal-error">
                ❌ {errorDetails}
                <div style={{ marginTop: '16px' }}>
                  <button className="btn btn-ghost" onClick={() => setSelectedId(null)}>Close</button>
                </div>
              </div>
            )}

            {!loadingDetails && !errorDetails && details && (
              <>
                <div className="modal-header">
                  <div>
                    <h2 className="modal-title">{details.booking.booking_reference}</h2>
                    <span className={`badge ${details.booking.status === 'checked_in' ? 'badge-green' : details.booking.status === 'checked_out' ? 'badge-accent' : 'badge-red'}`}>
                      {details.booking.status === 'checked_in' ? 'Active' : details.booking.status === 'checked_out' ? 'Checked Out' : 'Cancelled'}
                    </span>
                  </div>
                  <button className="close-btn" onClick={() => setSelectedId(null)}>&times;</button>
                </div>

                <div className="modal-body">
                  <div className="details-grid">
                    {/* Stay Info */}
                    <div className="details-section">
                      <h3>Stay Information</h3>
                      <div className="details-card">
                        <div className="detail-item">
                          <span className="detail-label">Check-In:</span>
                          <span className="detail-val">{fmtTime(details.booking.check_in_time)}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Check-Out Date:</span>
                          <span className="detail-val">{fmtDate(details.booking.check_out_date)}</span>
                        </div>
                        {details.booking.notes && (
                          <div className="detail-item notes-item">
                            <span className="detail-label">Special Notes:</span>
                            <span className="detail-val notes-text">{details.booking.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rooms Info */}
                    <div className="details-section">
                      <h3>Allocated Rooms</h3>
                      <div className="rooms-grid">
                        {details.rooms.map(r => (
                          <div key={r.id} className="room-detail-card">
                            <div className="room-number-badge">Room {r.room_number}</div>
                            <div className="room-meta-info">
                              <span>Type: {r.room_type}</span>
                              <span>Floor: {r.floor}</span>
                              <span className="room-price-info">₹{Number(r.price_per_night).toLocaleString('en-IN')}/night</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Guests Section */}
                  <div className="details-section">
                    <h3>Guests ({details.guests.length})</h3>
                    <div className="guests-grid">
                      {details.guests.map(g => (
                        <div key={g.id} className={`guest-detail-card ${g.is_primary_contact ? 'primary' : ''}`}>
                          <div className="guest-photo-container">
                            {g.photo_path ? (
                              <img src={`${API}/${g.photo_path}`} alt={g.name} className="guest-portrait" />
                            ) : (
                              <div className="guest-avatar-placeholder">
                                {g.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'G'}
                              </div>
                            )}
                          </div>
                          <div className="guest-info">
                            <div className="guest-name-row">
                              <span className="guest-detail-name">{g.name}</span>
                              {g.is_primary_contact && <span className="primary-star">★ Primary</span>}
                            </div>
                            <div className="guest-detail-meta">
                              {g.age ? `Age: ${g.age}` : 'Age: —'} · {g.sex ? g.sex.charAt(0).toUpperCase() + g.sex.slice(1) : 'Sex: —'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ID Proof Section */}
                  <div className="details-section">
                    <h3>ID Proof Document</h3>
                    <div className="id-proof-container">
                      {details.booking.id_proof_path ? (
                        <div className="id-proof-image-wrapper" onClick={() => setZoomImage(`${API}/${details.booking.id_proof_path}`)}>
                          <img src={`${API}/${details.booking.id_proof_path}`} alt="ID Proof Document" className="id-proof-image" />
                          <div className="id-proof-hover-overlay">Click to enlarge</div>
                        </div>
                      ) : (
                        <div className="no-id-proof">No ID proof document provided for this booking.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  {details.booking.status === 'checked_in' && (
                    <button
                      className="btn btn-danger"
                      onClick={() => {
                        checkout(details.booking.id)
                        setSelectedId(null)
                      }}
                    >
                      Check Out Guest Group
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => setSelectedId(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomImage && (
        <div className="zoom-backdrop" onClick={() => setZoomImage(null)}>
          <div className="zoom-container">
            <img src={zoomImage} alt="ID Proof Zoomed" className="zoom-img" />
            <button className="zoom-close-btn" onClick={() => setZoomImage(null)}>&times;</button>
          </div>
        </div>
      )}

      <style>{`
        .bookings-page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .page-title  { font-size: 24px; font-weight: 800; }
        .page-sub    { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
        .filter-btn  { padding: 8px 16px; border-radius: var(--r-sm); background: var(--bg-glass); color: var(--text-secondary); font-size: 12px; font-weight: 600; border: 1px solid var(--border); cursor: pointer; transition: all var(--t-fast); }
        .filter-btn.active { background: var(--accent-dim); color: var(--accent); border-color: rgba(108,99,255,0.3); }
        .filter-btn:hover:not(.active) { background: var(--bg-glass-hover); color: var(--text-primary); }
        .booking-list { display: flex; flex-direction: column; gap: 10px; }
        .booking-row  { padding: 18px 22px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; transition: box-shadow var(--t-fast), border-color var(--t-fast); }
        .clickable-row { cursor: pointer; }
        .clickable-row:hover { box-shadow: var(--shadow-sm); border-color: var(--border-strong); }
        .booking-ref  { display: flex; align-items: center; gap: 10px; min-width: 160px; }
        .ref-code     { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .booking-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: var(--text-muted); flex: 1; }
        .booking-guests { font-size: 13px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        .booking-actions { margin-left: auto; }
        .empty-state { text-align: center; padding: 60px; color: var(--text-muted); font-size: 14px; }
        .loading-state { display: flex; align-items: center; gap: 12px; color: var(--text-muted); font-size: 14px; padding: 40px 0; justify-content: center; }

        /* Modal Backdrop & Container */
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(4, 4, 6, 0.75);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: modalFadeIn 0.2s ease forwards;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .modal-content {
          width: 90%;
          max-width: 850px;
          max-height: 85vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          border-color: var(--border-strong);
          box-shadow: var(--shadow-lg);
          animation: modalSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          background: rgba(17, 17, 24, 0.95);
        }
        @keyframes modalSlideIn {
          from { transform: scale(0.95) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }

        .modal-loading, .modal-error {
          padding: 60px 24px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 15px;
        }

        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .modal-header > div {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .modal-title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .close-btn {
          background: transparent;
          color: var(--text-secondary);
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          transition: color var(--t-fast);
        }
        .close-btn:hover {
          color: var(--red);
        }

        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          text-align: left;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .details-grid { grid-template-columns: 1fr; }
        }

        .details-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .details-section h3 {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          border-left: 3px solid var(--accent);
          padding-left: 8px;
        }

        .details-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .detail-item {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }
        .detail-label {
          color: var(--text-secondary);
        }
        .detail-val {
          color: var(--text-primary);
          font-weight: 600;
        }
        .notes-item {
          flex-direction: column;
          gap: 6px;
          border-top: 1px solid var(--border);
          padding-top: 10px;
          margin-top: 4px;
          align-items: flex-start;
        }
        .notes-text {
          font-weight: 400;
          color: var(--text-secondary);
          line-height: 1.4;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .rooms-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .room-detail-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .room-number-badge {
          background: var(--accent-dim);
          color: var(--accent);
          font-weight: 700;
          font-size: 13px;
          padding: 4px 10px;
          border-radius: var(--r-sm);
          border: 1px solid rgba(108,99,255,0.2);
        }
        .room-meta-info {
          display: flex;
          gap: 16px;
          font-size: 12px;
          color: var(--text-secondary);
          align-items: center;
        }
        .room-price-info {
          color: var(--green);
          font-weight: 600;
        }

        /* Guests styles */
        .guests-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 600px) {
          .guests-grid { grid-template-columns: 1fr; }
        }
        .guest-detail-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .guest-detail-card.primary {
          border-color: rgba(108,99,255,0.25);
          background: rgba(108,99,255,0.03);
        }
        .guest-photo-container {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--bg-elevated);
          border: 1px solid var(--border-strong);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .guest-portrait {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .guest-avatar-placeholder {
          font-weight: 700;
          font-size: 13px;
          color: var(--accent);
        }
        .guest-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: flex-start;
        }
        .guest-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .guest-detail-name {
          font-weight: 600;
          font-size: 13.5px;
          color: var(--text-primary);
        }
        .primary-star {
          font-size: 10px;
          font-weight: 700;
          background: var(--accent-dim);
          color: var(--accent);
          padding: 1px 6px;
          border-radius: 99px;
        }
        .guest-detail-meta {
          font-size: 11.5px;
          color: var(--text-secondary);
        }

        /* ID Proof styles */
        .id-proof-container {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          padding: 16px;
          display: flex;
          justify-content: center;
        }
        .id-proof-image-wrapper {
          position: relative;
          max-width: 100%;
          max-height: 220px;
          border-radius: var(--r-sm);
          overflow: hidden;
          border: 1px solid var(--border-strong);
          cursor: pointer;
        }
        .id-proof-image {
          display: block;
          max-width: 100%;
          max-height: 220px;
          object-fit: contain;
          transition: transform var(--t-fast);
        }
        .id-proof-image-wrapper:hover .id-proof-image {
          transform: scale(1.02);
        }
        .id-proof-hover-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity var(--t-fast);
        }
        .id-proof-image-wrapper:hover .id-proof-hover-overlay {
          opacity: 1;
        }
        .no-id-proof {
          font-size: 13px;
          color: var(--text-muted);
          font-style: italic;
          padding: 20px 0;
        }

        .modal-footer {
          padding: 18px 24px;
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        /* Zoom modal styles */
        .zoom-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: modalFadeIn 0.15s ease forwards;
        }
        .zoom-container {
          position: relative;
          max-width: 90%;
          max-height: 90%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .zoom-img {
          max-width: 100%;
          max-height: 90vh;
          object-fit: contain;
          border-radius: var(--r-sm);
          box-shadow: 0 10px 40px rgba(0,0,0,0.8);
        }
        .zoom-close-btn {
          position: absolute;
          top: -40px; right: -10px;
          background: transparent;
          color: #fff;
          font-size: 36px;
          cursor: pointer;
          transition: opacity var(--t-fast);
        }
        .zoom-close-btn:hover {
          opacity: 0.8;
        }
      `}</style>
    </div>
  )
}
