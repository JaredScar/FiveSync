import React, { useEffect, useState, useRef } from 'react'
import { useStore } from '../store'

const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)
const IconWarning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IconNoConnect = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 6.3a10.94 10.94 0 0 0-1.93 6"/>
    <path d="M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>
  </svg>
)
const IconSearch = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)
const IconRefresh = ({ spinning }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }}>
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
  </svg>
)

function StatCard({ label, value, sub, icon, iconColor, action }) {
  return (
    <div style={{
      flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.02em' }}>{label}</div>
        <span style={{ color: iconColor || 'var(--text-muted)' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value || '—'}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>
        {action}
      </div>
    </div>
  )
}

function formatDuration(ms) {
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return dateStr }
}

function timeAgo(isoStr) {
  if (!isoStr) return null
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function StatusPill({ status }) {
  if (status === 'success') return <span className="pill pill-success"><span>✓</span> success</span>
  if (status === 'failed')  return <span className="pill pill-failed"><span>✕</span> failed</span>
  return <span className="pill pill-running">running</span>
}

export default function Dashboard({ onRefreshArtifact, onRefreshHistory }) {
  const {
    servers, activeServerId, artifactInfo, syncState, history, schedules,
    serverRunning, setArtifactInfo, setHistory, setSchedule, setServerRunning,
    setSyncState, addToast, setServers
  } = useStore()
  const server = servers.find((s) => s.id === activeServerId) || servers[0]

  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [checkedAt, setCheckedAt] = useState(null)
  const pollRef = useRef(null)

  async function handleRollback(targetBuild) {
    if (!server) return
    const state = useStore.getState().syncState[server.id]
    if (state?.running) return
    setSyncState(server.id, { running: true, progress: 0, logs: [] })
    const result = await window.api.sync.rollback(server.id, targetBuild)
    if (result?.status === 'success') {
      addToast({ type: 'success', message: `Rolled back to build ${result.build}` })
    }
  }

  // Scan server directory for installed build + running state
  async function scanServer(serverId) {
    setScanning(true)
    const result = await window.api.servers.scan(serverId)
    setScanning(false)
    if (!result || result.error) return

    setServerRunning(serverId, result.running)

    // If a new build was detected on disk, refresh the server list so the
    // sidebar and stat card show the updated value immediately.
    if (result.detectedBuild) {
      const updated = await window.api.servers.list()
      setServers(updated)
      if (result.detectedBuild !== server?.current_build) {
        addToast({ type: 'info', message: `Detected installed build: ${result.detectedBuild}` })
      }
    }
  }

  useEffect(() => {
    if (!server) return
    loadData(server.id)
    scanServer(server.id)

    // Poll process state every 15 s while the dashboard is visible
    pollRef.current = setInterval(() => {
      window.api.servers.scan(server.id).then((r) => {
        if (r && !r.error) setServerRunning(server.id, r.running)
      })
    }, 15000)

    return () => clearInterval(pollRef.current)
  }, [server?.id])

  async function loadData(serverId) {
    setLoading(true)
    const [info, hist, sched] = await Promise.all([
      window.api.artifact.check(serverId),
      window.api.history.list(serverId),
      window.api.schedule.get(serverId)
    ])
    setArtifactInfo(serverId, info)
    setHistory(serverId, hist)
    setSchedule(serverId, sched)
    if (info?.checkedAt) setCheckedAt(info.checkedAt)
    setLoading(false)
  }

  if (!server) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
        </svg>
        <p style={{ fontSize: 14 }}>No servers yet</p>
        <button className="btn btn-primary" onClick={() => useStore.getState().setShowAddServer(true)}>Add Your First Server</button>
      </div>
    )
  }

  const info = artifactInfo[server.id] || {}
  const hist = history[server.id] || []
  const sched = schedules[server.id] || {}
  const syncing = syncState[server.id]?.running
  const syncProgress = syncState[server.id]?.progress || 0
  const isRunning = serverRunning[server.id] ?? null   // null = not yet scanned

  const displayBuild = server.current_build
  const isUpToDate = info.upToDate
  const versionsBehind = info.versionsBehind

  let nextUpdateText = 'Not scheduled'
  let nextUpdateSub = 'Schedule disabled'
  if (sched?.enabled) {
    const days = (() => { try { return typeof sched.days === 'string' ? JSON.parse(sched.days) : sched.days } catch { return [] } })()
    const time = sched.update_time || '03:00'
    if (sched.schedule_type === 'daily') {
      nextUpdateText = `Today, ${time}`; nextUpdateSub = 'daily schedule active'
    } else if (sched.schedule_type === 'weekly' && days.length > 0) {
      const next = days[0]
      nextUpdateText = `${next.charAt(0).toUpperCase() + next.slice(1)}, ${time}`
      nextUpdateSub = 'weekly schedule active'
    } else if (sched.schedule_type === 'monthly') {
      nextUpdateText = `1st, ${time}`; nextUpdateSub = 'monthly schedule active'
    }
  }

  const checkedAgoStr = checkedAt ? `Last checked ${timeAgo(checkedAt)}` : loading ? 'Checking…' : 'Not checked yet'

  return (
    <div className="fade-in" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Monitoring {server.name}
          </p>
        </div>
        <button
          onClick={() => { scanServer(server.id); loadData(server.id) }}
          disabled={scanning || loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', padding: '5px 12px',
            borderRadius: 'var(--radius-sm)', fontSize: 12, transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          <IconRefresh spinning={scanning || loading} />
          {scanning ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {syncing && (
        <div style={{ background: 'var(--yellow-bg)', border: '1px solid var(--yellow)', borderRadius: 'var(--radius-md)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--yellow)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </span>
          <span style={{ fontSize: 12, flex: 1, color: 'var(--text-primary)' }}>Syncing… {syncProgress}%</span>
          <div style={{ width: 120, height: 4, background: 'var(--border)', borderRadius: 2 }}>
            <div style={{ height: '100%', background: 'var(--yellow)', borderRadius: 2, width: `${syncProgress}%`, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {info.error && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius-md)', padding: '10px 16px', fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {info.error}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 14 }}>
        <StatCard
          label="Current Artifact"
          value={displayBuild ? displayBuild.split('-')[0] : 'Unknown'}
          sub={checkedAgoStr}
          icon={displayBuild ? <IconCheck /> : <IconNoConnect />}
          iconColor={displayBuild ? 'var(--green)' : 'var(--text-muted)'}
          action={
            !displayBuild && (
              <button
                onClick={() => scanServer(server.id)}
                disabled={scanning}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--green-bg)', border: '1px solid var(--green-dark)',
                  color: 'var(--green)', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                  fontSize: 10, fontWeight: 600, cursor: 'pointer'
                }}
              >
                <IconSearch /> Detect
              </button>
            )
          }
        />
        <StatCard
          label="Latest Available"
          value={info.latestBuildNumber || (loading ? '…' : '—')}
          sub={
            loading ? 'Checking runtime.fivem.net…'
            : info.error ? 'Feed unavailable'
            : isUpToDate ? 'Up to date ✓'
            : versionsBehind ? `${versionsBehind} version${versionsBehind !== 1 ? 's' : ''} behind`
            : '—'
          }
          icon={isUpToDate ? <IconCheck /> : <IconWarning />}
          iconColor={loading ? 'var(--text-muted)' : info.error ? 'var(--red)' : isUpToDate ? 'var(--green)' : 'var(--yellow)'}
        />
        <StatCard
          label="Next Update"
          value={nextUpdateText}
          sub={nextUpdateSub}
          icon={<IconClock />}
          iconColor="var(--text-muted)"
        />
      </div>

      {/* Process status bar */}
      {isRunning !== null && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 12
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: isRunning ? 'var(--green)' : 'var(--text-muted)',
            boxShadow: isRunning ? '0 0 6px var(--green)' : 'none'
          }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            FXServer process: <strong style={{ color: isRunning ? 'var(--green)' : 'var(--text-primary)' }}>
              {isRunning ? 'Running' : 'Not running'}
            </strong>
          </span>
          {scanning && <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 11 }}>Scanning…</span>}
        </div>
      )}

      {/* Update history */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Update History</span>
        </div>
        {hist.length === 0 ? (
          <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No update history yet
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                {['Version', 'Previous', 'Date', 'Duration', 'Status', ''].map((h) => (
                  <th key={h} style={{ padding: '8px 18px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hist.map((row, i) => (
                <tr key={row.id} style={{ borderBottom: i < hist.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 18px', fontSize: 13, fontWeight: 600 }}>
                    {row.version && row.version !== 'failed' ? row.version.split('-')[0] : row.version}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {row.previous_version ? row.previous_version.split('-')[0] : '—'}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatDate(row.finished_at)}
                  </td>
                  <td style={{ padding: '10px 18px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {formatDuration(row.duration_ms)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 18px' }}>
                    <StatusPill status={row.status} />
                  </td>
                  <td style={{ padding: '6px 18px 6px 0' }}>
                    {row.status === 'success' && row.version !== server.current_build && (
                      <button
                        onClick={() => handleRollback(row.version)}
                        disabled={syncing}
                        style={{
                          background: 'transparent', color: 'var(--text-muted)', fontSize: 11,
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                          padding: '3px 8px', transition: 'all 0.15s', cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border-light)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                        title={`Roll back to build ${row.version}`}
                      >
                        rollback
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
