import React from 'react'
import { useStore } from '../store'

const IconDashboard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)
const IconSchedule = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IconSettings = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)
const IconServer = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
)
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const IconGithub = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
  </svg>
)
const IconHelp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconChevron = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
    <polyline points="18 15 12 9 6 15"/>
  </svg>
)

export default function Sidebar({ currentPage, onNavigate }) {
  const { servers, activeServerId, setActiveServerId, syncState, setShowAddServer } = useStore()

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
    { id: 'schedule',  label: 'Schedule',  icon: <IconSchedule /> },
    { id: 'settings',  label: 'Settings',  icon: <IconSettings /> }
  ]

  return (
    <aside style={{
      width: 136,
      minWidth: 136,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* Logo */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, background: 'var(--green-btn)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>FiveM</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', lineHeight: 1.2 }}>Updater</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>v1.0.0</div>
          </div>
        </div>
      </div>

      {/* Servers */}
      <div style={{ padding: '10px 0 4px' }}>
        <div style={{ padding: '0 12px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>SERVERS ({servers.length})</span>
          <IconChevron open />
        </div>
        <div style={{ overflowY: 'auto', maxHeight: 180 }}>
          {servers.map((server) => {
            const isActive = server.id === activeServerId
            const syncing = useStore.getState().syncState[server.id]?.running
            return (
              <button
                key={server.id}
                onClick={() => { setActiveServerId(server.id); onNavigate('dashboard') }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', background: isActive ? 'var(--bg-active)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderLeft: isActive ? '2px solid var(--green)' : '2px solid transparent',
                  textAlign: 'left', transition: 'all 0.12s'
                }}
              >
                <IconServer />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {server.name}
                  </div>
                  <div style={{ fontSize: 10, color: syncing ? 'var(--yellow)' : 'var(--text-muted)' }}>
                    {syncing ? 'syncing…' : server.current_build ? `v${server.current_build.split('-')[0]}` : 'not set'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setShowAddServer(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 7,
            padding: '6px 12px', background: 'transparent', color: 'var(--text-muted)',
            textAlign: 'left', fontSize: 12, transition: 'color 0.12s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <IconPlus /> Add Server
        </button>
      </div>

      {/* Navigation */}
      <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '0 12px 6px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
          NAVIGATION
        </div>
        {navItems.map((item) => {
          const active = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', background: active ? 'var(--bg-active)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
                textAlign: 'left', fontSize: 13, transition: 'all 0.12s'
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom links */}
      <div style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
        {[
          { icon: <IconGithub />, label: 'GitHub', url: 'https://github.com' },
          { icon: <IconHelp />, label: 'Help', url: '#' }
        ].map((link) => (
          <button
            key={link.label}
            onClick={() => window.api.shell.open(link.url)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', background: 'transparent', color: 'var(--text-muted)',
              textAlign: 'left', fontSize: 12, transition: 'color 0.12s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            {link.icon}
            {link.label}
          </button>
        ))}
      </div>
    </aside>
  )
}
