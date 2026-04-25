import { execFileSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, extname, resolve } from 'path'

/**
 * @typedef {{ pid: number, name: string, path: string | null, commandLine: string | null }} ProcessInfo
 */

const PATH_SEP_NORM = /[\\/]+/g

function normPath(s) {
  if (!s) return ''
  return String(s).toLowerCase().replace(PATH_SEP_NORM, process.platform === 'win32' ? '\\' : '/')
}

/**
 * List running processes (pid, name, path when available, command line when available).
 */
export function listRunningProcesses() {
  if (process.platform === 'win32') {
    return listProcessesWindows()
  }
  return listProcessesPosix()
}

function listProcessesWindows() {
  const ps =
    'Get-CimInstance Win32_Process | ' +
    'Select-Object -First 4000 ProcessId,Name,ExecutablePath,CommandLine | ' +
    'ForEach-Object { [ordered]@{ pid = [int]$_.ProcessId; name = $_.Name; path = $_.ExecutablePath; commandLine = $_.CommandLine } } | ' +
    'ConvertTo-Json -Depth 2 -Compress'
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], {
    maxBuffer: 32 * 1024 * 1024,
    timeout: 45000,
    windowsHide: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const t = out.trim()
  if (!t) return []
  let parsed
  try {
    parsed = JSON.parse(t)
  } catch {
    return []
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed]
  return arr
    .map((p) => ({
      pid: Number(p.pid),
      name: p.name == null ? '' : String(p.name),
      path: p.path == null || p.path === '' ? null : String(p.path),
      commandLine: p.commandLine == null ? null : String(p.commandLine)
    }))
    .filter((p) => Number.isFinite(p.pid))
}

function listProcessesPosix() {
  const out = execFileSync('ps', ['-A', '-o', 'pid=', '-o', 'args='], {
    maxBuffer: 20 * 1024 * 1024,
    timeout: 20000,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  })
  const lines = out.split('\n')
  const result = []
  for (const line of lines) {
    const s = line.trim()
    if (!s) continue
    const m = s.match(/^\s*(\d+)\s+(.+)$/)
    if (!m) continue
    const pid = parseInt(m[1], 10)
    if (!Number.isFinite(pid)) continue
    const args = m[2]
    const parts = args.trim().split(/\s+/)
    const name = parts[0] ? parts[0].split('/').pop() || parts[0] : ''
    result.push({ pid, name, path: null, commandLine: args })
  }
  return result
}

function legacyIsRunningServerProcess(serverPath) {
  if (!serverPath) return false
  try {
    if (process.platform === 'win32') {
      const cmd =
        'Get-Process FXServer -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path'
      const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
        windowsHide: true
      })
        .toString()
        .toLowerCase()
      if (!out.trim()) return false
      const norm = normPath(serverPath)
      return out.replace(PATH_SEP_NORM, '\\').includes(norm)
    }
    const out = execFileSync('sh', ['-c', 'pgrep -f "FXServer|run.sh" 2>/dev/null || true'], {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    })
      .toString()
      .trim()
    return out.length > 0
  } catch {
    return false
  }
}

/**
 * @param {any} server
 */
function matchConfiguredProcess(server) {
  const type = server.process_match_type
  const value = (server.process_match_value || '').trim()
  if (!type || !value) return null

  const procs = listRunningProcesses()
  if (type === 'pid') {
    const n = parseInt(value, 10)
    if (!Number.isFinite(n)) return null
    const p = procs.find((x) => x.pid === n)
    return p || null
  }
  if (type === 'path') {
    const v = normPath(value)
    for (const p of procs) {
      if (p.path && normPath(p.path) === v) return p
    }
    for (const p of procs) {
      if (p.commandLine && normPath(p.commandLine).includes(v)) return p
    }
  }
  if (type === 'name') {
    const v = value.replace(/\.exe$/i, '').toLowerCase()
    for (const p of procs) {
      const n = (p.name || '').replace(/\.exe$/i, '').toLowerCase()
      if (n === v) return p
    }
  }
  return null
}

/**
 * @returns {ProcessInfo | null}
 */
function findLegacyFxServerProcess(server) {
  if (!server?.path) return null
  if (process.platform === 'win32') {
    try {
      const cmd =
        'Get-Process FXServer -ErrorAction SilentlyContinue | Select-Object Id,Path | ConvertTo-Json -Compress'
      const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], {
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf8',
        windowsHide: true
      }).toString()
      const norm = normPath(server.path)
      const t = out.trim()
      if (!t) return null
      const parsed = JSON.parse(t)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const p of arr) {
        const pathStr = p.Path ? String(p.Path) : ''
        if (pathStr && pathStr.toLowerCase().replace(PATH_SEP_NORM, '\\').includes(norm)) {
          return { pid: Number(p.Id), name: 'FXServer', path: pathStr, commandLine: null }
        }
      }
    } catch {
      return null
    }
  } else {
    const procs = listRunningProcesses()
    const v = normPath(server.path)
    for (const p of procs) {
      const n = (p.name || '').toLowerCase()
      if (n.includes('fxserver') && p.commandLine && normPath(p.commandLine).includes(v)) {
        return p
      }
    }
  }
  return null
}

/**
 * Whether a server-related process is running (user-configured, or legacy FXServer + path).
 * @param {any} server
 */
export function isServerProcessRunning(server) {
  if (!server) return false
  if (typeof server === 'string') {
    return legacyIsRunningServerProcess(server)
  }
  if (server.process_match_type && (server.process_match_value || '').trim()) {
    return !!matchConfiguredProcess(server)
  }
  return legacyIsRunningServerProcess(server.path)
}

/**
 * @returns {ProcessInfo | null} matched process, or null if not running / not configured
 */
export function findMatchingServerProcess(server) {
  if (!server || typeof server === 'string') return null
  if (server.process_match_type && (server.process_match_value || '').trim()) {
    return matchConfiguredProcess(server)
  }
  return findLegacyFxServerProcess(server)
}

function processExists(pid) {
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 2 * 1024 * 1024
      })
      return out.includes(String(pid))
    } catch {
      return false
    }
  }
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    if (e && e.code === 'ESRCH') return false
    return true
  }
}

/**
 * @param {number} pid
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
function waitForProcessExit(pid, timeoutMs) {
  const start = Date.now()
  return new Promise((resolve) => {
    const tick = () => {
      if (!processExists(pid)) {
        resolve()
        return
      }
      if (Date.now() - start > timeoutMs) {
        resolve()
        return
      }
      setTimeout(tick, 200)
    }
    tick()
  })
}

/**
 * @param {number} pid
 */
function killProcessHard(pid) {
  if (process.platform === 'win32') {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore'
    })
  } else {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      /* ESRCH */
    }
  }
}

/**
 * Stop the configured (or legacy) process before applying artifact files.
 * @param {any} server
 * @param {(s: string) => void} [log]
 * @returns {Promise<{ stopped: boolean, reason?: string, pid?: number }>}
 */
export async function stopServerProcessForUpdate(server, log) {
  const p = findMatchingServerProcess(server)
  if (!p) {
    if (server.process_match_type && (server.process_match_value || '').trim()) {
      log?.('No running process matched your selection. Continuing update without stopping a process.')
      return { stopped: false, reason: 'no_match' }
    }
    log?.('No matching server process is running (legacy check). Proceeding with update.')
    return { stopped: false, reason: 'not_running' }
  }
  log?.(`Stopping process PID ${p.pid} (${p.name || 'process'}) before applying files…`)
  try {
    killProcessHard(p.pid)
  } catch (e) {
    const msg = e && e.message ? e.message : String(e)
    const err = new Error(`Failed to stop process ${p.pid}: ${msg}`)
    err.cause = e
    throw err
  }
  await waitForProcessExit(p.pid, 20000)
  if (processExists(p.pid)) {
    throw new Error(
      `Process ${p.pid} is still running after stop attempt. Close it manually, then try again.`
    )
  }
  log?.('Server process stopped.')
  return { stopped: true, pid: p.pid, reason: 'ok' }
}

/**
 * @param {any} server
 * @returns {{ started: boolean, error?: string, message?: string, pid?: number }}
 */
export function startServerCommand(server) {
  const filePath = (server.start_command_path || '').trim()
  if (!filePath) {
    return { started: false, message: 'No start command configured' }
  }
  if (!existsSync(filePath)) {
    return { started: false, error: `Start command not found: ${filePath}` }
  }
  const wdir = (server.start_working_dir || '').trim()
  const cwd =
    wdir && existsSync(wdir) ? resolve(wdir) : dirname(resolve(filePath))
  const ext = extname(filePath).toLowerCase()
  const common = {
    cwd,
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }
  let child
  if (process.platform === 'win32') {
    if (ext === '.bat' || ext === '.cmd') {
      child = spawn(process.env.ComSpec || 'cmd.exe', ['/c', filePath], common)
    } else if (ext === '.ps1') {
      child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', filePath], common)
    } else {
      child = spawn(filePath, [], common)
    }
  } else {
    if (ext === '.sh' || filePath.endsWith('.sh')) {
      child = spawn('/bin/sh', [filePath], common)
    } else {
      child = spawn(filePath, [], { ...common, shell: false })
    }
  }
  child.unref()
  return { started: true, pid: child.pid }
}
