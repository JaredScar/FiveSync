import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

let dbPath
let _db = null

function load() {
  if (!existsSync(dbPath)) {
    _db = { servers: [], schedules: [], history: [], nextId: { servers: 1, schedules: 1, history: 1 } }
    save()
  } else {
    try {
      _db = JSON.parse(readFileSync(dbPath, 'utf8'))
    } catch {
      _db = { servers: [], schedules: [], history: [], nextId: { servers: 1, schedules: 1, history: 1 } }
      save()
    }
  }
  if (!_db.nextId) _db.nextId = { servers: 1, schedules: 1, history: 1 }
  return _db
}

function save() {
  writeFileSync(dbPath, JSON.stringify(_db, null, 2), 'utf8')
}

function db() {
  if (!_db) load()
  return _db
}

function nextId(table) {
  const id = db().nextId[table] || 1
  db().nextId[table] = id + 1
  return id
}

export function initDb() {
  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  dbPath = join(userDataPath, 'fivesync.json')
  load()
}

export function getServers() {
  return db().servers.slice().sort((a, b) => a.id - b.id)
}

export function getServer(id) {
  return db().servers.find((s) => s.id === id) || null
}

export function createServer(data) {
  const id = nextId('servers')
  const server = {
    id,
    name: data.name,
    path: data.path,
    platform: data.platform || 'windows',
    artifact_channel: data.artifact_channel || 'recommended',
    current_build: data.current_build || null,
    update_mode: data.update_mode || 'latest',
    pinned_build: data.pinned_build || null,
    auth_type: data.auth_type || 'none',
    auth_token: data.auth_token || null,
    auth_user: data.auth_user || null,
    auth_pass: data.auth_pass || null,
    auth_header_name: data.auth_header_name || null,
    auth_header_value: data.auth_header_value || null,
    // Server process: match running process to stop before updates; start command after install
    process_match_type: data.process_match_type || null, // 'path' | 'name' | null (legacy: FXServer)
    process_match_value: data.process_match_value || null,
    start_command_path: data.start_command_path || null,
    start_working_dir: data.start_working_dir || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  db().servers.push(server)

  const schedId = nextId('schedules')
  db().schedules.push({
    id: schedId,
    server_id: id,
    enabled: false,
    schedule_type: 'weekly',
    days: JSON.stringify(['mon', 'wed', 'fri']),
    update_time: '03:00',
    auto_restart: false,
    backup_before_update: false
  })
  save()
  return server
}

export function updateServer(id, data) {
  const idx = db().servers.findIndex((s) => s.id === id)
  if (idx === -1) return null
  const updated = {
    ...db().servers[idx],
    ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null)),
    id,
    updated_at: new Date().toISOString()
  }
  db().servers[idx] = updated
  save()
  return updated
}

export function deleteServer(id) {
  _db.servers = _db.servers.filter((s) => s.id !== id)
  _db.schedules = _db.schedules.filter((s) => s.server_id !== id)
  _db.history = _db.history.filter((h) => h.server_id !== id)
  save()
}

export function getSchedule(serverId) {
  return db().schedules.find((s) => s.server_id === serverId) || null
}

export function upsertSchedule(serverId, data) {
  const idx = db().schedules.findIndex((s) => s.server_id === serverId)
  const record = {
    server_id: serverId,
    enabled: !!data.enabled,
    schedule_type: data.schedule_type || 'weekly',
    days: typeof data.days === 'string' ? data.days : JSON.stringify(data.days || ['mon', 'wed', 'fri']),
    update_time: data.update_time || '03:00',
    auto_restart: !!data.auto_restart,
    backup_before_update: !!data.backup_before_update
  }
  if (idx === -1) {
    const id = nextId('schedules')
    db().schedules.push({ id, ...record })
  } else {
    db().schedules[idx] = { ...db().schedules[idx], ...record }
  }
  save()
  return getSchedule(serverId)
}

export function getUpdateHistory(serverId, limit = 20) {
  return db().history
    .filter((h) => h.server_id === serverId)
    .sort((a, b) => {
      const timeDiff = new Date(b.started_at) - new Date(a.started_at)
      return timeDiff !== 0 ? timeDiff : b.id - a.id
    })
    .slice(0, limit)
}

export function addUpdateHistory(serverId, data) {
  const id = nextId('history')
  const record = {
    id,
    server_id: serverId,
    version: data.version,
    previous_version: data.previous_version || null,
    started_at: data.started_at || new Date().toISOString(),
    finished_at: data.finished_at || new Date().toISOString(),
    duration_ms: data.duration_ms || null,
    status: data.status || 'success',
    error: data.error || null
  }
  db().history.push(record)
  save()
  return record
}
