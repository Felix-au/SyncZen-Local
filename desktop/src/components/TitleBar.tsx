// Window title bar with custom controls for Electron frameless window
declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

export default function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="6" width="20" height="14" rx="2" stroke="var(--accent)" strokeWidth="1.5"/>
            <path d="M7 6V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" stroke="var(--accent)" strokeWidth="1.5"/>
            <circle cx="12" cy="13" r="2" fill="var(--accent)"/>
          </svg>
        </div>
        <span className="titlebar-title">Hotel Check-In</span>
        <span className="titlebar-subtitle">Command Center</span>
      </div>
      <div className="titlebar-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="titlebar-btn" onClick={() => window.electronAPI?.minimize()} title="Minimize">
          <span className="btn-icon minimize" />
        </button>
        <button className="titlebar-btn" onClick={() => window.electronAPI?.maximize()} title="Maximize">
          <span className="btn-icon maximize" />
        </button>
        <button className="titlebar-btn close" onClick={() => window.electronAPI?.close()} title="Close">
          <span className="btn-icon close-icon" />
        </button>
      </div>
      <style>{`
        .titlebar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 48px;
          padding: 0 16px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          -webkit-app-region: drag;
          user-select: none;
          flex-shrink: 0;
        }
        .titlebar-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .titlebar-logo {
          width: 32px;
          height: 32px;
          background: var(--accent-dim);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(108,99,255,0.25);
        }
        .titlebar-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: 0.01em;
        }
        .titlebar-subtitle {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 400;
        }
        .titlebar-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .titlebar-btn {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter 0.15s;
          padding: 0;
        }
        .titlebar-btn:has(.minimize)  { background: #ffbd2e; }
        .titlebar-btn:has(.maximize)  { background: #28c840; }
        .titlebar-btn:has(.close-icon){ background: #ff5f57; }
        .titlebar-btn:hover { filter: brightness(1.15); }
      `}</style>
    </div>
  )
}
