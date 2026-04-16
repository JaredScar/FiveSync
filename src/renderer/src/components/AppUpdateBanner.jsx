import React, { useEffect, useState } from 'react'

export default function AppUpdateBanner() {
  const [state, setState] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const unsub = window.api.on('app-update-event', (event) => {
      if (event.type === 'update-available') {
        setState({ type: 'available', version: event.version })
      } else if (event.type === 'download-progress') {
        setState({ type: 'downloading', percent: event.percent })
      } else if (event.type === 'update-downloaded') {
        setState({ type: 'ready', version: event.version })
        setDownloading(false)
      } else if (event.type === 'update-error') {
        setState({ type: 'error', message: event.message })
        setDownloading(false)
      }
    })
    return () => unsub && unsub()
  }, [])

  if (!state) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 136, right: 0, zIndex: 50,
      background: state.type === 'error' ? 'var(--red-bg)' : 'var(--green-bg)',
      borderBottom: `1px solid ${state.type === 'error' ? 'var(--red)' : 'var(--green)'}`,
      padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 12
    }}>
      <span style={{ fontSize: 12, flex: 1, color: 'var(--text-primary)' }}>
        {state.type === 'available' && `FiveSync v${state.version} is available`}
        {state.type === 'downloading' && `Downloading update… ${state.percent}%`}
        {state.type === 'ready' && `Update v${state.version} downloaded — restart to apply`}
        {state.type === 'error' && `Auto-update error: ${state.message}`}
      </span>

      {state.type === 'available' && (
        <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
          disabled={downloading}
          onClick={async () => {
            setDownloading(true)
            setState({ type: 'downloading', percent: 0 })
            await window.api.appUpdate.download()
          }}>
          Download
        </button>
      )}
      {state.type === 'ready' && (
        <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
          onClick={() => window.api.appUpdate.install()}>
          Restart & Install
        </button>
      )}
      <button onClick={() => setState(null)} style={{
        background: 'transparent', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: '0 4px'
      }}>×</button>
    </div>
  )
}
