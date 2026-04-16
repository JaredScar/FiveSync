import React, { useState } from 'react'
import { useStore } from '../store'

export default function AddServerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    path: '',
    platform: 'windows',
    artifact_channel: 'recommended',
    current_build: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { addToast } = useStore()

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }))

  async function handleBrowse() {
    const folder = await window.api.dialog.openFolder()
    if (folder) set('path', folder)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Server name is required'); return }
    if (!form.path.trim()) { setError('Server path is required'); return }
    if (!form.current_build.trim()) { setError('Current artifact/build is required'); return }
    setError('')
    setLoading(true)
    try {
      // Ensure we persist a numeric build number string (e.g. 28108).
      const payload = {
        ...form,
        current_build: form.current_build.replace(/\D/g, '')
      }
      await window.api.servers.create(payload)
      await onCreated()
      addToast({ type: 'success', message: `Server "${form.name}" added` })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 24, width: 400, maxWidth: '90vw'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Add New Server</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Configure a new FiveM server for automatic artifact updates
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
            padding: '0 4px'
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Server Name</label>
            <input
              className="input"
              placeholder="My FiveM Server"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Server Path</label>
            <div className="input-with-icon">
              <input
                className="input"
                placeholder="C:\FXServer\server"
                value={form.path}
                onChange={(e) => set('path', e.target.value)}
              />
              <span className="input-icon" onClick={handleBrowse} title="Browse folder">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
            </div>
          </div>

          <div className="field">
            <label>Current Artifact/Build</label>
            <input
              className="input"
              placeholder="e.g. 28108 (enter the build number)"
              value={form.current_build}
              onChange={(e) => set('current_build', e.target.value.replace(/\D/g, ''))}
            />
            <span className="field-hint">
              FiveM may not expose the build number on disk. If your server is already running, enter it once.
            </span>
          </div>

          <div className="field">
            <label>Platform</label>
            <select className="input" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
            </select>
          </div>

          <div className="field">
            <label>Artifact Channel</label>
            <select className="input" value={form.artifact_channel} onChange={(e) => set('artifact_channel', e.target.value)}>
              <option value="recommended">Recommended (Stable)</option>
              <option value="latest">Latest</option>
              <option value="optional">Optional</option>
            </select>
          </div>

          {error && (
            <div style={{ color: 'var(--red)', fontSize: 12, padding: '6px 10px', background: 'var(--red-bg)', borderRadius: 'var(--radius-sm)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding…' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
