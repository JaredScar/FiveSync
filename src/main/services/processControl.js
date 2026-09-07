import { execFileSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { dirname, extname, join, resolve } from 'path'

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
function matchConfiguredProcesses(server) {
  const type = server.process_match_type
  const value = (server.process_match_value || '').trim()
  if (!type || !value) return []

  let procs
  try {
    procs = listRunningProcesses()
  } catch {
    // If listing processes fails (e.g. PowerShell timeout/permission), treat as
    // "no match found" so the sync can still proceed without stopping anything.
    return []
  }
  const found = []
  if (type === 'path') {
    const v = normPath(value)
    for (const p of procs) {
      if (p.path && normPath(p.path) === v) found.push(p)
      else if (p.commandLine && normPath(p.commandLine).includes(v)) found.push(p)
    }
  } else if (type === 'name') {
    const v = value.replace(/\.exe$/i, '').toLowerCase()
    for (const p of procs) {
      const n = (p.name || '').replace(/\.exe$/i, '').toLowerCase()
      if (n === v) found.push(p)
    }
  }
  return found
}

/**
 * @returns {ProcessInfo[]}
 */
function findLegacyFxServerProcesses(server) {
  if (!server?.path) return []
  const found = []
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
      if (!t) return []
      const parsed = JSON.parse(t)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      for (const p of arr) {
        const pathStr = p.Path ? String(p.Path) : ''
        if (pathStr && pathStr.toLowerCase().replace(PATH_SEP_NORM, '\\').includes(norm)) {
          found.push({ pid: Number(p.Id), name: 'FXServer', path: pathStr, commandLine: null })
        }
      }
    } catch {
      return []
    }
  } else {
    try {
      const procs = listRunningProcesses()
      const v = normPath(server.path)
      for (const p of procs) {
        const n = (p.name || '').toLowerCase()
        if (n.includes('fxserver') && p.commandLine && normPath(p.commandLine).includes(v)) {
          found.push(p)
        }
      }
    } catch {
      return []
    }
  }
  return found
}

/**
 * Collect every process that must be stopped before copying artifacts:
 * configured match(es) + any FXServer living under the server path.
 * Dedupes by PID.
 * @returns {ProcessInfo[]}
 */
export function findAllServerProcessesToStop(server) {
  if (!server || typeof server === 'string') return []
  const byPid = new Map()
  for (const p of matchConfiguredProcesses(server)) {
    if (p?.pid && Number.isFinite(p.pid)) byPid.set(p.pid, p)
  }
  for (const p of findLegacyFxServerProcesses(server)) {
    if (p?.pid && Number.isFinite(p.pid)) byPid.set(p.pid, p)
  }
  return [...byPid.values()]
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
    return matchConfiguredProcesses(server).length > 0 || findLegacyFxServerProcesses(server).length > 0
  }
  return legacyIsRunningServerProcess(server.path)
}

/**
 * @returns {ProcessInfo | null} matched process, or null if not running / not configured
 */
export function findMatchingServerProcess(server) {
  if (!server || typeof server === 'string') return null
  return findAllServerProcessesToStop(server)[0] || null
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
 * Stop all matching server processes (configured + FXServer under path) before applying files.
 * @param {any} server
 * @param {(s: string) => void} [log]
 * @returns {Promise<{ stopped: boolean, reason?: string, pids?: number[] }>}
 */
export async function stopServerProcessForUpdate(server, log) {
  const targets = findAllServerProcessesToStop(server)
  if (targets.length === 0) {
    if (server.process_match_type && (server.process_match_value || '').trim()) {
      log?.(
        'No running process matched your selection (and no FXServer under the server path). Continuing update without stopping a process.'
      )
      return { stopped: false, reason: 'no_match' }
    }
    log?.('No matching server process is running. Proceeding with update.')
    return { stopped: false, reason: 'not_running' }
  }

  const pids = targets.map((p) => p.pid)
  log?.(
    `Stopping ${targets.length} process(es) before applying files: ${targets
      .map((p) => `PID ${p.pid} (${p.name || 'process'})`)
      .join(', ')}…`
  )

  for (const p of targets) {
    try {
      killProcessHard(p.pid)
    } catch (e) {
      // Process may already have exited; ignore "not found" style failures
      if (processExists(p.pid)) {
        const msg = e && e.message ? e.message : String(e)
        const err = new Error(`Failed to stop process ${p.pid}: ${msg}`)
        err.cause = e
        throw err
      }
    }
  }

  await Promise.all(pids.map((pid) => waitForProcessExit(pid, 20000)))

  const stillAlive = pids.filter((pid) => processExists(pid))
  if (stillAlive.length > 0) {
    throw new Error(
      `Process(es) still running after stop attempt: ${stillAlive.join(', ')}. Close them manually, then try again.`
    )
  }

  // Give Windows a moment to release DLL handles (botan.dll / FXServer.exe locks).
  await new Promise((r) => setTimeout(r, 1500))

  // Re-check: another FXServer may have been spawned or missed
  const remaining = findAllServerProcessesToStop(server)
  if (remaining.length > 0) {
    log?.(
      `Found ${remaining.length} additional process(es) still holding the server — stopping them…`
    )
    for (const p of remaining) {
      try {
        killProcessHard(p.pid)
      } catch {
        /* ignore */
      }
    }
    await Promise.all(remaining.map((p) => waitForProcessExit(p.pid, 10000)))
    await new Promise((r) => setTimeout(r, 1000))
  }

  log?.('Server process(es) stopped.')
  return { stopped: true, pids, reason: 'ok' }
}

/**
 * Resolve the launcher to run after an update.
 * Prefer the configured start command; otherwise fall back to FXServer in the server path.
 * @param {any} server
 * @returns {string}
 */
function resolveStartCommandPath(server) {
  const configured = (server.start_command_path || '').trim()
  if (configured) return configured
  if (!server?.path) return ''
  const candidates =
    process.platform === 'win32'
      ? [join(server.path, 'FXServer.exe')]
      : [join(server.path, 'run.sh'), join(server.path, 'FXServer')]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return ''
}

/**
 * @param {any} server
 * @returns {{ started: boolean, error?: string, message?: string, pid?: number, path?: string }}
 */
export function startServerCommand(server) {
  const filePath = resolveStartCommandPath(server)
  if (!filePath) {
    return {
      started: false,
      message:
        'No start command configured and no FXServer found in the server folder — set “Start after update” in Settings.'
    }
  }
  if (!existsSync(filePath)) {
    return { started: false, error: `Start command not found: ${filePath}` }
  }

  const resolvedFile = resolve(filePath)
  const wdir = (server.start_working_dir || '').trim()
  const cwd =
    wdir && existsSync(wdir) ? resolve(wdir) : dirname(resolvedFile)
  const ext = extname(resolvedFile).toLowerCase()

  let child
  try {
    if (process.platform === 'win32') {
      // Use `cmd /c start` so the process is fully detached and paths with spaces work.
      // First quoted arg after `start` is the window title (required when the path is quoted).
      const comspec = process.env.ComSpec || 'cmd.exe'
      const title = 'FiveSync Server'
      let inner
      if (ext === '.bat' || ext === '.cmd') {
        inner = `start "${title}" /D "${cwd}" "${resolvedFile}"`
      } else if (ext === '.ps1') {
        inner = `start "${title}" /D "${cwd}" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${resolvedFile}"`
      } else {
        inner = `start "${title}" /D "${cwd}" "${resolvedFile}"`
      }
      child = spawn(comspec, ['/S', '/C', inner], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      })
    } else if (ext === '.sh' || resolvedFile.endsWith('.sh')) {
      child = spawn('/bin/sh', [resolvedFile], {
        cwd,
        detached: true,
        stdio: 'ignore'
      })
    } else {
      child = spawn(resolvedFile, [], {
        cwd,
        detached: true,
        stdio: 'ignore'
      })
    }
  } catch (e) {
    const msg = e && e.message ? e.message : String(e)
    return { started: false, error: msg, path: resolvedFile }
  }

  if (!child || !child.pid) {
    return { started: false, error: 'Failed to spawn start command (no PID)', path: resolvedFile }
  }

  child.unref()
  return { started: true, pid: child.pid, path: resolvedFile }
}
