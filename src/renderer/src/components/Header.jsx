import React, { useState } from 'react'
import { useStore } from '../store'

const IconRefresh = ({ spinning }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}>
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
  </svg>
)

const IconBell = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

export default function Header({ server, onSyncNow }) {
  const { syncState, serverRunning } = useStore()
  const syncing = server ? syncState[server?.id]?.running : false
  const progress = server ? syncState[server?.id]?.progress : 0

  // null = not yet scanned, true/false = real process state
  const runningState = server ? serverRunning[server?.id] : null
  const isOnline = runningState === true

  return (
    <header style={{
      height: 46,
      background: 'var(--bg-sidebar)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 10,
      flexShrink: 0,
      position: 'relative'
    }}>
      {server ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: isOnline ? 'var(--green)' : 'var(--text-muted)',
              boxShadow: isOnline ? '0 0 5px var(--green)' : 'none'
            }} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{server.name}</span>
            <span style={{ fontSize: 12, color: runningState === null ? 'var(--text-muted)' : isOnline ? 'var(--green)' : 'var(--text-muted)' }}>
              {runningState === null ? 'Scanning…' : isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {syncing && (
            <div style={{ flex: 1, maxWidth: 200, marginLeft: 12 }}>
              <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                <div style={{
                  height: '100%', background: 'var(--green)', borderRadius: 2,
                  width: `${progress || 0}%`, transition: 'width 0.3s'
                }} />
              </div>
            </div>
          )}
        </>
      ) : (
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No server selected</span>
      )}

      <div style={{ flex: 1 }} />

      <button
        onClick={onSyncNow}
        disabled={!server || syncing}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: syncing ? 'var(--text-muted)' : 'var(--text-primary)',
          padding: '5px 12px', borderRadius: 'var(--radius-sm)',
          fontSize: 12, fontWeight: 500, transition: 'all 0.15s'
        }}
        onMouseEnter={(e) => { if (!syncing) e.currentTarget.style.borderColor = 'var(--border-light)' }}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <IconRefresh spinning={syncing} />
        {syncing ? `Updating… ${progress || 0}%` : 'Update Now'}
      </button>

      <button style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', transition: 'all 0.15s'
      }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <IconBell />
      </button>
    </header>
  )
}
