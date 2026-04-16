import React from 'react'
import { useStore } from '../store'

const icons = {
  success: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
}

const colors = {
  success: { bg: 'var(--green-bg)', border: 'var(--green)', color: 'var(--green)' },
  error:   { bg: 'var(--red-bg)',   border: 'var(--red)',   color: 'var(--red)' },
  info:    { bg: 'rgba(59,130,246,0.12)', border: 'var(--blue)', color: 'var(--blue)' }
}

export default function ToastContainer() {
  const { toasts, removeToast } = useStore()

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 200,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320
    }}>
      {toasts.map((toast) => {
        const c = colors[toast.type] || colors.info
        return (
          <div key={toast.id} className="fade-in" style={{
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            backdropFilter: 'blur(8px)'
          }}>
            <span style={{ color: c.color, flexShrink: 0 }}>{icons[toast.type]}</span>
            <span style={{ fontSize: 13, flex: 1, color: 'var(--text-primary)' }}>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} style={{
              background: 'transparent', color: 'var(--text-muted)', fontSize: 16,
              lineHeight: 1, padding: '0 2px', flexShrink: 0
            }}>×</button>
          </div>
        )
      })}
    </div>
  )
}
