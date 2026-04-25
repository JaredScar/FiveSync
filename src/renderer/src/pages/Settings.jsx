import React, { useEffect, useState } from 'react'
import { useStore } from '../store'

export default function Settings({ onDeleteServer, onSaveSettings }) {
  const { servers, activeServerId, artifactInfo, setArtifactInfo, addToast } = useStore()
  const server = servers.find((s) => s.id === activeServerId) || servers[0]

  const [form, setForm] = useState({
    name: '',
    path: '',
    platform: 'windows',
    artifact_channel: 'recommended',
    update_mode: 'latest',
    pinned_build: '',
    current_build: '',
    auth_type: 'none',
    auth_token: '',
    auth_user: '',
    auth_pass: '',
    auth_header_name: '',
    auth_header_value: '',
    process_match_type: '',
    process_match_value: '',
    start_command_path: '',
    start_working_dir: ''
  })
  const [showAuth, setShowAuth] = useState(false)
  const [availableBuilds, setAvailableBuilds] = useState([])
  const [loadingBuilds, setLoadingBuilds] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [checkingArtifact, setCheckingArtifact] = useState(false)
  const [processList, setProcessList] = useState([])
  const [loadingProcesses, setLoadingProcesses] = useState(false)
  const [processSearch, setProcessSearch] = useState('')

  useEffect(() => {
    if (!server) return
    setForm({
      name: server.name || '',
      path: server.path || '',
      platform: server.platform || 'windows',
      artifact_channel: server.artifact_channel || 'recommended',
      update_mode: server.update_mode || 'latest',
      pinned_build: server.pinned_build || '',
      current_build: server.current_build ? server.current_build.split('-')[0] : '',
      auth_type: server.auth_type || 'none',
      auth_token: server.auth_token || '',
      auth_user: server.auth_user || '',
      auth_pass: server.auth_pass || '',
      auth_header_name: server.auth_header_name || '',
      auth_header_value: server.auth_header_value || '',
      process_match_type: server.process_match_type || '',
      process_match_value: server.process_match_value || '',
      start_command_path: server.start_command_path || '',
      start_working_dir: server.start_working_dir || ''
    })
    loadArtifactInfo(server.id)
    setConfirmDelete(false)
  }, [server?.id])

  async function loadArtifactInfo(serverId) {
    setCheckingArtifact(true)
    const info = await window.api.artifact.check(serverId)
    setArtifactInfo(serverId, info)
    setCheckingArtifact(false)
  }

  async function loadAvailableBuilds() {
    setLoadingBuilds(true)
    const { builds } = await window.api.artifact.builds()
    setAvailableBuilds(builds || [])
    setLoadingBuilds(false)
  }

  async function loadRunningProcesses() {
    setLoadingProcesses(true)
    const { processes, error } = await window.api.processes.list()
    if (error) {
      addToast({ type: 'error', message: error })
      setProcessList([])
    } else {
      setProcessList(processes || [])
    }
    setLoadingProcesses(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!server) return
    if (!form.name.trim()) { addToast({ type: 'error', message: 'Server name cannot be empty' }); return }
    if (!form.path.trim()) { addToast({ type: 'error', message: 'Server path cannot be empty' }); return }
    if (form.process_match_type && !String(form.process_match_value || '').trim()) {
      addToast({ type: 'error', message: 'Process match is enabled — enter a match value, pick a process, or clear Process match' })
      return
    }
    // We need a current build number to compare "up-to-date" and to display a meaningful
    // artifact status before the first managed update runs.
    if (!form.current_build.trim()) { addToast({ type: 'error', message: 'Current artifact/build is required' }); return }
    setSaving(true)
    try {
      // Persist current_build as the raw number string (no hash suffix needed for manual entry)
      const saveData = { ...form }
      if (saveData.current_build) saveData.current_build = saveData.current_build.trim()
      // Empty strings clear process fields in DB; omit nulls so merge keeps behavior
      if (!saveData.process_match_type) saveData.process_match_type = ''
      if (!saveData.process_match_value) saveData.process_match_value = ''
      if (!saveData.start_command_path) saveData.start_command_path = ''
      if (!saveData.start_working_dir) saveData.start_working_dir = ''
      await window.api.servers.update(server.id, saveData)
      await onSaveSettings()
      addToast({ type: 'success', message: 'Settings saved' })
    } catch (err) {
      addToast({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!server) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    await onDeleteServer(server.id)
    setConfirmDelete(false)
  }

  if (!server) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        No server selected
      </div>
    )
  }

  const info = artifactInfo[server.id] || {}
  const processQuery = processSearch.trim().toLowerCase()
  const filteredProcesses = processList
    .map((p, idx) => ({ ...p, idx }))
    .filter((p) => {
      if (!processQuery) return true
      return [p.name, p.path, p.commandLine]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(processQuery))
    })
    .slice(0, 50)

  function applyProcessSelection(processInfo) {
    const pathValue =
      processInfo.path ||
      (processInfo.commandLine && processInfo.commandLine.trim().split(/\s+/)[0]) ||
      ''

    if (pathValue) {
      setForm((f) => ({
        ...f,
        process_match_type: 'path',
        process_match_value: pathValue
      }))
      return
    }

    setForm((f) => ({
      ...f,
      process_match_type: 'name',
      process_match_value: processInfo.name || ''
    }))
  }

  return (
    <div className="fade-in" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Server Settings</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Configure <strong>{server.name}</strong></p>
        </div>
        <button
          className="btn btn-danger"
          onClick={handleDelete}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          {confirmDelete ? 'Click again to confirm' : 'Delete Server'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: Server Configuration */}
        <form onSubmit={handleSave} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Server Configuration</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Set up your FiveM server paths and preferences</div>
          </div>

          <div className="field">
            <label>Server Name</label>
            <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Main RP Server" />
            <span className="field-hint">A friendly name to identify this server</span>
          </div>

          <div className="field">
            <label>Server Path</label>
            <div className="input-with-icon">
              <input className="input" value={form.path} onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))} placeholder="C:\FXServer\main-rp" />
              <span className="input-icon" title="Browse folder" onClick={async () => {
                const folder = await window.api.dialog.openFolder()
                if (folder) setForm((f) => ({ ...f, path: folder }))
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
            </div>
            <span className="field-hint">Path to your FiveM server installation folder</span>
          </div>

          <div className="field">
            <label>Current Build</label>
            <input
              className="input"
              placeholder="e.g. 28108 — enter manually for existing installs"
              value={form.current_build}
              onChange={(e) => setForm((f) => ({ ...f, current_build: e.target.value.replace(/\D/g, '') }))}
            />
            <span className="field-hint">
              FiveM does not store the build number on disk. Enter yours manually, or FiveSync will track it automatically after the first update.
            </span>
          </div>

          <div className="field">
            <label>Platform</label>
            <select className="input" value={form.platform} onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}>
              <option value="windows">Windows</option>
              <option value="linux">Linux</option>
            </select>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Server process (updates)</div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              Stop a chosen process before installing artifacts, then start a launcher (e.g. a <code style={{ fontSize: 10 }}>.bat</code> or <code style={{ fontSize: 10 }}>FXServer.exe</code>).
              Leave match on default to auto-detect <strong>FXServer</strong> under your server path.
            </p>
            <div className="field">
              <label>Process match strategy</label>
              <select
                className="input"
                value={form.process_match_type}
                onChange={(e) => setForm((f) => ({ ...f, process_match_type: e.target.value }))}
              >
                <option value="">Default (FXServer under server path)</option>
                <option value="path">Executable path</option>
                <option value="name">Process name</option>
              </select>
              <span className="field-hint">
                Use executable path when possible; fall back to process name when a path is not available.
              </span>
            </div>
            {form.process_match_type && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={loadRunningProcesses}
                    disabled={loadingProcesses}
                    style={{
                      fontSize: 12,
                      padding: '5px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {loadingProcesses ? 'Loading processes…' : 'Refresh running processes'}
                  </button>
                </div>
                {processList.length > 0 && (
                  <div className="field">
                    <label>Pick a running process</label>
                    <input
                      className="input"
                      value={processSearch}
                      onChange={(e) => setProcessSearch(e.target.value)}
                      placeholder="Search by name, path, or command line"
                      style={{ marginBottom: 8 }}
                    />
                    <div
                      style={{
                        maxHeight: 180,
                        overflowY: 'auto',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-input)'
                      }}
                    >
                      {filteredProcesses.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                          No matching processes
                        </div>
                      ) : (
                        filteredProcesses.map((p) => (
                          <button
                            key={`${p.pid}-${p.idx}`}
                            type="button"
                            onClick={() => applyProcessSelection(p)}
                            title="Use this process as a stable path/name match"
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: '8px 10px',
                              background: 'transparent',
                              borderBottom: '1px solid var(--border)',
                              color: 'var(--text-secondary)',
                              fontSize: 11
                            }}
                          >
                            <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {p.name || 'Unknown process'}
                            </div>
                            <div style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.path || p.commandLine || 'No path available'}
                            </div>
                            <div style={{ marginTop: 2, color: 'var(--text-muted)' }}>
                              Click to save as {p.path || p.commandLine ? 'executable path' : 'process name'}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    {processList.length > 50 && (
                      <span className="field-hint">
                        Showing up to 50 matches. Use search to narrow the process list.
                      </span>
                    )}
                  </div>
                )}
                <div className="field">
                  <label>{form.process_match_type === 'path' ? 'Executable path match' : 'Process name match'} (required)</label>
                  <input
                    className="input"
                    value={form.process_match_value}
                    onChange={(e) => setForm((f) => ({ ...f, process_match_value: e.target.value }))}
                    placeholder={
                      form.process_match_type === 'path' ? 'C:\\...\\server.exe or full path'
                        : 'e.g. FXServer'
                    }
                  />
                </div>
              </>
            )}
            <div className="field">
              <label>Start after update</label>
              <div className="input-with-icon">
                <input
                  className="input"
                  value={form.start_command_path}
                  onChange={(e) => setForm((f) => ({ ...f, start_command_path: e.target.value }))}
                  placeholder="Path to .bat, .cmd, .ps1, .sh, or .exe"
                />
                <span
                  className="input-icon"
                  title="Browse file"
                  onClick={async () => {
                    const file = await window.api.dialog.openFile()
                    if (file) setForm((f) => ({ ...f, start_command_path: file }))
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><path d="M10 9H8.5a2.5 2.5 0 0 0 0 5H10"/>
                  </svg>
                </span>
              </div>
              <span className="field-hint">If empty, FiveSync will not start the server after an update (you can start it yourself).</span>
            </div>
            <div className="field">
              <label>Start working directory (optional)</label>
              <div className="input-with-icon">
                <input
                  className="input"
                  value={form.start_working_dir}
                  onChange={(e) => setForm((f) => ({ ...f, start_working_dir: e.target.value }))}
                  placeholder="Defaults to the launcher’s folder or server path"
                />
                <span
                  className="input-icon"
                  title="Browse folder"
                  onClick={async () => {
                    const folder = await window.api.dialog.openFolder()
                    if (folder) setForm((f) => ({ ...f, start_working_dir: folder }))
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </span>
              </div>
            </div>
          </div>

          <div className="field">
            <label>Artifact Channel</label>
            <select className="input" value={form.artifact_channel} onChange={(e) => setForm((f) => ({ ...f, artifact_channel: e.target.value }))}>
              <option value="recommended">Recommended (Stable)</option>
              <option value="latest">Latest</option>
              <option value="optional">Optional</option>
            </select>
            <span className="field-hint">Choose which artifact channel to follow for updates</span>
          </div>

          <div className="field">
            <label>Update Mode</label>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
              {['latest', 'pinned'].map((m) => (
                <button key={m} type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, update_mode: m }))
                    if (m === 'pinned' && availableBuilds.length === 0) loadAvailableBuilds()
                  }}
                  style={{
                    flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                    background: form.update_mode === m ? 'var(--bg-card)' : 'transparent',
                    color: form.update_mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 500,
                    border: form.update_mode === m ? '1px solid var(--border)' : '1px solid transparent',
                    transition: 'all 0.15s'
                  }}>
                  {m === 'latest' ? 'Always Latest' : 'Pinned Build'}
                </button>
              ))}
            </div>
            <span className="field-hint">
              {form.update_mode === 'latest'
                ? 'Always update to the newest available build on each sync'
                : 'Lock to a specific build number — useful for staging servers'}
            </span>
          </div>

          {form.update_mode === 'pinned' && (
            <div className="field">
              <label>Pinned Build</label>
              {loadingBuilds ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading available builds…</div>
              ) : (
                <select
                  className="input"
                  value={form.pinned_build}
                  onChange={(e) => setForm((f) => ({ ...f, pinned_build: e.target.value }))}>
                  <option value="">— select a build —</option>
                  {availableBuilds.map((b) => (
                    <option key={b.buildId} value={b.buildId}>
                      {b.buildNumber}{b.buildId === server.current_build ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
              )}
              <span className="field-hint">The server will only ever be synced to this build</span>
            </div>
          )}

          {/* Authentication (collapsible) */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <button type="button"
              onClick={() => setShowAuth((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, width: '100%', textAlign: 'left'
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ transform: showAuth ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              Connector Authentication
              {form.auth_type !== 'none' && (
                <span style={{ marginLeft: 6, background: 'var(--green-bg)', color: 'var(--green)', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
                  {form.auth_type}
                </span>
              )}
            </button>

            {showAuth && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field">
                  <label>Auth Type</label>
                  <select className="input" value={form.auth_type} onChange={(e) => setForm((f) => ({ ...f, auth_type: e.target.value }))}>
                    <option value="none">None (public feed)</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth (username/password)</option>
                    <option value="custom">Custom Header</option>
                  </select>
                </div>
                {form.auth_type === 'bearer' && (
                  <div className="field">
                    <label>Bearer Token</label>
                    <input className="input" type="password" value={form.auth_token} onChange={(e) => setForm((f) => ({ ...f, auth_token: e.target.value }))} placeholder="your-token" />
                  </div>
                )}
                {form.auth_type === 'basic' && (
                  <>
                    <div className="field">
                      <label>Username</label>
                      <input className="input" value={form.auth_user} onChange={(e) => setForm((f) => ({ ...f, auth_user: e.target.value }))} placeholder="username" />
                    </div>
                    <div className="field">
                      <label>Password</label>
                      <input className="input" type="password" value={form.auth_pass} onChange={(e) => setForm((f) => ({ ...f, auth_pass: e.target.value }))} placeholder="password" />
                    </div>
                  </>
                )}
                {form.auth_type === 'custom' && (
                  <>
                    <div className="field">
                      <label>Header Name</label>
                      <input className="input" value={form.auth_header_name} onChange={(e) => setForm((f) => ({ ...f, auth_header_name: e.target.value }))} placeholder="X-API-Key" />
                    </div>
                    <div className="field">
                      <label>Header Value</label>
                      <input className="input" type="password" value={form.auth_header_value} onChange={(e) => setForm((f) => ({ ...f, auth_header_value: e.target.value }))} placeholder="value" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={saving} style={{ marginTop: 4, padding: '10px 0', fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </form>

        {/* Right: Artifacts Source */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Artifacts Source</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Information about the artifact download source</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Source URL', value: 'runtime.fivem.net', link: 'https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/' },
              { label: 'Current Channel', value: form.artifact_channel === 'recommended' ? 'Recommended' : form.artifact_channel },
              { label: 'Platform', value: form.platform === 'windows' ? 'Windows' : 'Linux' }
            ].map((row, i, arr) => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.label}</span>
                {row.link ? (
                  <button onClick={() => window.api.shell.open(row.link)}
                    style={{ background: 'none', color: 'var(--green)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {row.value}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </button>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{row.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Build info */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Build Information</div>
            {checkingArtifact ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Checking remote builds…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: 'Current Build', value: server.current_build || 'Unknown' },
                  { label: 'Latest Build', value: info.latestBuildNumber ? String(info.latestBuildNumber) : (info.error ? 'Error' : '—') },
                  { label: 'Last Checked', value: info.error ? 'Failed' : '2 hours ago' },
                  { label: 'Server Status', value: server.current_build ? 'Online' : 'Offline', color: server.current_build ? 'var(--green)' : 'var(--text-muted)' }
                ].map((row, i, arr) => (
                  <div key={row.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none'
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: row.color || 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => window.api.shell.open('https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)', padding: '7px 12px', borderRadius: 'var(--radius-sm)',
              fontSize: 12, width: 'fit-content', transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            View Changelog
          </button>
        </div>
      </div>
    </div>
  )
}
