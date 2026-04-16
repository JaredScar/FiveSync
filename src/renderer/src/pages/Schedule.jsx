import React, { useEffect, useState } from 'react'
import { useStore } from '../store'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export default function Schedule() {
  const { servers, activeServerId, schedules, setSchedule, addToast } = useStore()
  const server = servers.find((s) => s.id === activeServerId) || servers[0]

  const [form, setForm] = useState({
    enabled: false,
    schedule_type: 'weekly',
    days: ['mon', 'wed', 'fri'],
    update_time: '03:00',
    auto_restart: false,
    backup_before_update: false
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!server) return
    loadSchedule(server.id)
  }, [server?.id])

  async function loadSchedule(serverId) {
    const sched = await window.api.schedule.get(serverId)
    if (sched) {
      let days = sched.days
      try { days = typeof days === 'string' ? JSON.parse(days) : days } catch { days = ['mon', 'wed', 'fri'] }
      setForm({
        enabled: !!sched.enabled,
        schedule_type: sched.schedule_type || 'weekly',
        days: days || ['mon', 'wed', 'fri'],
        update_time: sched.update_time || '03:00',
        auto_restart: !!sched.auto_restart,
        backup_before_update: !!sched.backup_before_update
      })
      setSchedule(serverId, sched)
    }
  }

  function toggleDay(key) {
    setForm((f) => ({
      ...f,
      days: f.days.includes(key) ? f.days.filter((d) => d !== key) : [...f.days, key]
    }))
  }

  async function handleSave() {
    if (!server) return
    setSaving(true)
    try {
      const saved = await window.api.schedule.save(server.id, { ...form, days: JSON.stringify(form.days) })
      setSchedule(server.id, saved)
      addToast({ type: 'success', message: 'Schedule saved' })
    } catch (err) {
      addToast({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  function buildSummary() {
    if (!form.enabled) return 'Schedule disabled'
    const time = form.update_time || '03:00'
    if (form.schedule_type === 'daily') return `Every day at ${time}`
    if (form.schedule_type === 'monthly') return `1st of every month at ${time}`
    if (form.schedule_type === 'weekly') {
      if (form.days.length === 0) return `No days selected`
      const names = form.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')
      return `Updates on ${names} at ${time}`
    }
    return '—'
  }

  if (!server) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        No server selected
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Schedule Settings</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Configure update schedule for <strong>{server.name}</strong>
          </p>
        </div>
        {form.enabled && (
          <span style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-dark)', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
            Schedule Active
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: Update Schedule */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Update Schedule</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Choose how often to check for updates
              </div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
              <span className="toggle-track" />
            </label>
          </div>

          {/* Schedule type tabs */}
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>Schedule Type</div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: 3 }}>
              {['daily', 'weekly', 'monthly'].map((t) => (
                <button key={t} onClick={() => setForm((f) => ({ ...f, schedule_type: t }))}
                  style={{
                    flex: 1, padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                    background: form.schedule_type === t ? 'var(--bg-card)' : 'transparent',
                    color: form.schedule_type === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 500, border: form.schedule_type === t ? '1px solid var(--border)' : '1px solid transparent',
                    transition: 'all 0.15s'
                  }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Days (weekly only) */}
          {form.schedule_type === 'weekly' && (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 500 }}>Days of the Week</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {DAYS.map((day, i) => {
                  const key = DAY_KEYS[i]
                  const active = form.days.includes(key)
                  return (
                    <button key={key} onClick={() => toggleDay(key)} style={{
                      width: 36, height: 32, borderRadius: 'var(--radius-sm)',
                      background: active ? 'var(--green-btn)' : 'var(--bg-input)',
                      color: active ? '#000' : 'var(--text-secondary)',
                      border: `1px solid ${active ? 'var(--green-btn)' : 'var(--border)'}`,
                      fontSize: 11, fontWeight: 600, transition: 'all 0.15s'
                    }}>{day}</button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Time */}
          <div className="field">
            <label>Update Time</label>
            <div style={{ position: 'relative' }}>
              <input
                type="time"
                className="input"
                value={form.update_time}
                onChange={(e) => setForm((f) => ({ ...f, update_time: e.target.value }))}
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <span className="field-hint">Updates will run at this time in your local timezone</span>
          </div>
        </div>

        {/* Right: Update Options + Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Update Options</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Configure update behavior for this server</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Auto-restart Server</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Automatically restart the server after updating</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.auto_restart} onChange={(e) => setForm((f) => ({ ...f, auto_restart: e.target.checked }))} />
                <span className="toggle-track" />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Backup Before Update</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Create a backup before applying updates</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={form.backup_before_update} onChange={(e) => setForm((f) => ({ ...f, backup_before_update: e.target.checked }))} />
                <span className="toggle-track" />
              </label>
            </div>

            {/* Schedule summary */}
            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Schedule Summary</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{buildSummary()}</div>
            </div>
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '11px 0', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
