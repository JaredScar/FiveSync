import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, existsSync, rmSync, cpSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createRequire } from 'module'
import axios from 'axios'
import { getServer, updateServer, addUpdateHistory } from './db'
import { resolveTargetBuild, parseBuildNumber } from './connector'
import { writeMarkerBuild } from './serverStatus'

// Load 7zip-bin at runtime via createRequire so that Node resolves the package
// from node_modules using the package's own __dirname — not the bundle output dir.
// A static `import { path7za } from '7zip-bin'` causes rollup to inline the module,
// replacing __dirname with the bundle path and producing a broken binary path.
const _require = createRequire(import.meta.url)
const { path7za } = _require('7zip-bin')

const execFileAsync = promisify(execFile)
const activeJobs = new Map()

export function getActiveJob(serverId) {
  return activeJobs.get(serverId) || null
}

export function cancelJob(serverId) {
  const job = activeJobs.get(serverId)
  if (job) {
    job.cancelled = true
    activeJobs.delete(serverId)
  }
}

// ---------------------------------------------------------------------------
// extractArchive — uses the bundled 7za binary to extract a .7z to outputDir
// ---------------------------------------------------------------------------
function extractArchive(archivePath, outputDir) {
  return new Promise((resolve, reject) => {
    // -y = yes to all prompts, -bsp0 = suppress progress spam
    const child = execFile(
      path7za,
      ['x', archivePath, `-o${outputDir}`, '-y', '-bsp0'],
      { maxBuffer: 50 * 1024 * 1024 }
    )
    let stderr = ''
    child.stderr?.on('data', (d) => { stderr += d })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`7zip exited with code ${code}: ${stderr.trim()}`))
    })
    child.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// copyDir — recursively copy src → dest, overwriting existing files
// ---------------------------------------------------------------------------
function copyDir(src, dest) {
  cpSync(src, dest, {
    recursive: true,
    force: true,
    errorOnExist: false,
    // Skip files we can't overwrite (e.g. locked FXServer.exe when server is running)
    filter: (srcPath) => {
      try {
        return true
      } catch {
        return false
      }
    }
  })
}

export async function runSyncJob(serverId, onProgress, onLog, options = {}) {
  if (activeJobs.has(serverId)) {
    throw new Error('A sync job is already running for this server')
  }

  const job = { cancelled: false, serverId, startedAt: Date.now() }
  activeJobs.set(serverId, job)

  const log = (msg) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`
    if (onLog) onLog(line)
  }

  try {
    const server = getServer(serverId)
    if (!server) throw new Error('Server not found')
    if (!server.path) throw new Error('Server path is not configured')

    log(`Starting sync for "${server.name}" (mode: ${server.update_mode || 'latest'})...`)
    onProgress && onProgress(5)

    const { build: targetBuild, mode } = await resolveTargetBuild(server)
    if (job.cancelled) return { status: 'cancelled' }

    log(`Target build resolved: ${targetBuild.buildId} [${mode}]`)
    onProgress && onProgress(10)

    const currentBuildNum = parseBuildNumber(server.current_build)
    const targetBuildNum = parseBuildNumber(targetBuild.buildId)

    if (
      !options.force &&
      mode === 'latest' &&
      currentBuildNum !== null &&
      currentBuildNum >= targetBuildNum
    ) {
      log('Server is already up to date.')
      onProgress && onProgress(100)
      activeJobs.delete(serverId)
      return { status: 'up_to_date', build: server.current_build }
    }

    if (
      !options.force &&
      mode === 'pinned' &&
      server.current_build &&
      parseBuildNumber(server.current_build) === targetBuildNum
    ) {
      log('Server is already on the pinned build.')
      onProgress && onProgress(100)
      activeJobs.delete(serverId)
      return { status: 'up_to_date', build: server.current_build }
    }

    log(`Update: ${server.current_build || 'none'} → ${targetBuild.buildId}${mode === 'pinned' ? ' (pinned)' : ''}`)
    onProgress && onProgress(15)

    // -----------------------------------------------------------------------
    // Step 1: Download the artifact archive
    // -----------------------------------------------------------------------
    const userDataPath = app.getPath('userData')
    const cacheDir = join(userDataPath, 'cache', String(serverId))
    const stagingDir = join(userDataPath, 'staging', String(serverId))
    mkdirSync(cacheDir, { recursive: true })
    mkdirSync(stagingDir, { recursive: true })

    const downloadUrl = targetBuild.downloadUrl
    const archivePath = join(cacheDir, `${targetBuild.buildId}.7z`)

    if (existsSync(archivePath)) {
      log(`Using cached archive: ${archivePath}`)
      onProgress && onProgress(55)
    } else {
      log(`Downloading from: ${downloadUrl}`)
      onProgress && onProgress(20)

      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 600000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          ...buildAuthHeaders(server)
        }
      })

      const totalLength = parseInt(response.headers['content-length'] || '0', 10)
      let downloaded = 0

      await new Promise((resolve, reject) => {
        const writer = createWriteStream(archivePath)
        response.data.on('data', (chunk) => {
          downloaded += chunk.length
          if (totalLength > 0) {
            const pct = 20 + Math.floor((downloaded / totalLength) * 35)
            onProgress && onProgress(pct)
          }
          if (job.cancelled) {
            writer.close()
            reject(new Error('Job cancelled'))
          }
        })
        response.data.pipe(writer)
        writer.on('finish', resolve)
        writer.on('error', reject)
      })

      log(`Download complete (${(downloaded / 1024 / 1024).toFixed(1)} MB).`)
    }

    if (job.cancelled) return { status: 'cancelled' }

    // -----------------------------------------------------------------------
    // Step 2: Extract the archive to a staging directory
    // -----------------------------------------------------------------------
    log('Extracting archive…')
    onProgress && onProgress(60)

    // Wipe the staging dir so we start fresh
    rmSync(stagingDir, { recursive: true, force: true })
    mkdirSync(stagingDir, { recursive: true })

    await extractArchive(archivePath, stagingDir)
    log('Extraction complete.')
    onProgress && onProgress(80)

    if (job.cancelled) return { status: 'cancelled' }

    // -----------------------------------------------------------------------
    // Step 3: Copy extracted files into the server directory
    // -----------------------------------------------------------------------
    log(`Applying update to server directory: ${server.path}`)
    onProgress && onProgress(85)

    try {
      copyDir(stagingDir, server.path)
    } catch (copyErr) {
      // Warn but don't abort — some files may be locked while FXServer is running.
      // The server will pick up the updates next time it restarts.
      log(`Warning: some files could not be replaced (server may be running): ${copyErr.message}`)
    }

    // -----------------------------------------------------------------------
    // Step 4: Persist the new build number and record history
    // -----------------------------------------------------------------------
    const previousBuild = server.current_build
    updateServer(serverId, { current_build: targetBuild.buildId })
    writeMarkerBuild(server.path, targetBuild.buildId)

    const durationMs = Date.now() - job.startedAt
    addUpdateHistory(serverId, {
      version: targetBuild.buildId,
      previous_version: previousBuild,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      status: 'success'
    })

    log(`✓ Update complete! Server is now on build ${targetBuild.buildId.split('-')[0]}.`)
    onProgress && onProgress(100)
    activeJobs.delete(serverId)

    return { status: 'success', build: targetBuild.buildId, previousBuild }
  } catch (err) {
    const server = getServer(serverId)
    const durationMs = Date.now() - (job.startedAt || Date.now())

    if (!job.cancelled) {
      addUpdateHistory(serverId, {
        version: 'failed',
        previous_version: server?.current_build,
        finished_at: new Date().toISOString(),
        duration_ms: durationMs,
        status: 'failed',
        error: err.message
      })
    }

    log(`✗ Error: ${err.message}`)
    activeJobs.delete(serverId)
    throw err
  }
}

function buildAuthHeaders(server) {
  const headers = {}
  if (server.auth_type === 'bearer' && server.auth_token) {
    headers['Authorization'] = `Bearer ${server.auth_token}`
  } else if (server.auth_type === 'basic' && server.auth_user && server.auth_pass) {
    const encoded = Buffer.from(`${server.auth_user}:${server.auth_pass}`).toString('base64')
    headers['Authorization'] = `Basic ${encoded}`
  } else if (server.auth_type === 'custom' && server.auth_header_name && server.auth_header_value) {
    headers[server.auth_header_name] = server.auth_header_value
  }
  return headers
}
