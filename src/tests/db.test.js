import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'

// Mock electron's app.getPath to use a temp dir
vi.mock('electron', () => ({
  app: {
    getPath: () => join(tmpdir(), 'fivesync-test-' + process.pid)
  }
}))

let db
let testDir

beforeEach(async () => {
  testDir = join(tmpdir(), 'fivesync-test-' + process.pid)
  mkdirSync(testDir, { recursive: true })
  // Re-import to reset module state between tests
  vi.resetModules()
  db = await import('../main/services/db.js')
  db.initDb()
})

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true })
  }
})

describe('Server CRUD', () => {
  it('creates a server and returns it with an id', () => {
    const server = db.createServer({ name: 'Test Server', path: 'C:\\FXServer', platform: 'windows' })
    expect(server.id).toBeGreaterThan(0)
    expect(server.name).toBe('Test Server')
    expect(server.platform).toBe('windows')
    expect(server.update_mode).toBe('latest')
  })

  it('getServers returns all created servers', () => {
    db.createServer({ name: 'A', path: '/a' })
    db.createServer({ name: 'B', path: '/b' })
    const servers = db.getServers()
    expect(servers).toHaveLength(2)
  })

  it('getServer returns the correct server by id', () => {
    const created = db.createServer({ name: 'RP Server', path: 'C:\\rp' })
    const fetched = db.getServer(created.id)
    expect(fetched.name).toBe('RP Server')
  })

  it('getServer returns null for unknown id', () => {
    expect(db.getServer(9999)).toBeNull()
  })

  it('updateServer changes specified fields', () => {
    const s = db.createServer({ name: 'Old Name', path: '/old' })
    const updated = db.updateServer(s.id, { name: 'New Name' })
    expect(updated.name).toBe('New Name')
    expect(updated.path).toBe('/old')
  })

  it('deleteServer removes the server', () => {
    const s = db.createServer({ name: 'ToDelete', path: '/d' })
    db.deleteServer(s.id)
    expect(db.getServer(s.id)).toBeNull()
    expect(db.getServers()).toHaveLength(0)
  })

  it('deleteServer also removes associated schedule and history', () => {
    const s = db.createServer({ name: 'Test', path: '/t' })
    db.addUpdateHistory(s.id, { version: '7290', status: 'success' })
    db.deleteServer(s.id)
    expect(db.getSchedule(s.id)).toBeNull()
    expect(db.getUpdateHistory(s.id)).toHaveLength(0)
  })
})

describe('Schedule CRUD', () => {
  it('creates a default schedule when server is created', () => {
    const s = db.createServer({ name: 'S', path: '/s' })
    const sched = db.getSchedule(s.id)
    expect(sched).not.toBeNull()
    expect(sched.enabled).toBe(false)
    expect(sched.schedule_type).toBe('weekly')
  })

  it('upsertSchedule updates an existing schedule', () => {
    const s = db.createServer({ name: 'S', path: '/s' })
    db.upsertSchedule(s.id, { enabled: true, schedule_type: 'daily', update_time: '04:00', days: ['mon'] })
    const sched = db.getSchedule(s.id)
    expect(sched.enabled).toBe(true)
    expect(sched.schedule_type).toBe('daily')
    expect(sched.update_time).toBe('04:00')
  })
})

describe('Update History', () => {
  it('addUpdateHistory persists a record', () => {
    const s = db.createServer({ name: 'H', path: '/h' })
    db.addUpdateHistory(s.id, { version: '7295', previous_version: '7290', status: 'success', duration_ms: 120000 })
    const hist = db.getUpdateHistory(s.id)
    expect(hist).toHaveLength(1)
    expect(hist[0].version).toBe('7295')
    expect(hist[0].status).toBe('success')
    expect(hist[0].duration_ms).toBe(120000)
  })

  it('getUpdateHistory returns records in descending date order', () => {
    const s = db.createServer({ name: 'H', path: '/h' })
    db.addUpdateHistory(s.id, { version: '7285', status: 'success' })
    db.addUpdateHistory(s.id, { version: '7290', status: 'success' })
    db.addUpdateHistory(s.id, { version: '7295', status: 'failed' })
    const hist = db.getUpdateHistory(s.id)
    expect(hist[0].version).toBe('7295')
  })

  it('respects limit parameter', () => {
    const s = db.createServer({ name: 'H', path: '/h' })
    for (let i = 0; i < 5; i++) db.addUpdateHistory(s.id, { version: `720${i}`, status: 'success' })
    expect(db.getUpdateHistory(s.id, 3)).toHaveLength(3)
  })
})
