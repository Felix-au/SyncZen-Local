import type { Page } from '../App'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard',  icon: '⊞' },
  { id: 'rooms',     label: 'Rooms',      icon: '🏨' },
  { id: 'bookings',  label: 'Bookings',   icon: '📋' },
  { id: 'pairing',   label: 'Pairing',    icon: '📡' },
]

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`sidebar-item ${currentPage === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <span className="sidebar-icon">{icon}</span>
            <span className="sidebar-label">{label}</span>
            {currentPage === id && <span className="sidebar-indicator" />}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-version">v1.0.0</div>
      </div>

      <style>{`
        .sidebar {
          width: 220px;
          flex-shrink: 0;
          background: var(--bg-surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 16px 12px;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          border-radius: var(--r-md);
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          position: relative;
          width: 100%;
          text-align: left;
          transition: all var(--t-fast);
        }
        .sidebar-item:hover {
          background: var(--bg-glass-hover);
          color: var(--text-primary);
        }
        .sidebar-item.active {
          background: var(--accent-dim);
          color: var(--accent);
          font-weight: 600;
        }
        .sidebar-icon {
          font-size: 16px;
          width: 20px;
          text-align: center;
          flex-shrink: 0;
        }
        .sidebar-label { flex: 1; }
        .sidebar-indicator {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--accent);
        }
        .sidebar-footer {
          padding: 8px 14px;
        }
        .sidebar-version {
          font-size: 11px;
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
        }
      `}</style>
    </aside>
  )
}
