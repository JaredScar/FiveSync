import { app } from 'electron'
import { join } from 'path'
import { createWriteStream, mkdirSync, existsSync } from 'fs'
import axios from 'axios'
import { getServer, updateServer, addUpdateHistory } from './db'
import { resolveTargetBuild, parseBuildNumber } from './connector'
import { writeMarkerBuild } from './serverStatus'

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

    log(`Starting sync for "${server.name}" (mode: ${server.update_mode || 'latest'})...`)
    onProgress && onProgress(5)

    const { build: targetBuild, mode } = await resolveTargetBuild(server)
    if (job.cancelled) return { status: 'cancelled' }

    log(`Target build resolved: ${targetBuild.buildId} [${mode}]`)
    onProgress && onProgress(15)

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

    log(
      `Update: ${server.current_build || 'none'} → ${targetBuild.buildId}${mode === 'pinned' ? ' (pinned)' : ''}`
    )
    onProgress && onProgress(20)

    const userDataPath = app.getPath('userData')
    const cacheDir = join(userDataPath, 'cache', String(serverId))
    const stagingDir = join(userDataPath, 'staging', String(serverId))
    mkdirSync(cacheDir, { recursive: true })
    mkdirSync(stagingDir, { recursive: true })

    const downloadUrl = targetBuild.downloadUrl
    const archivePath = join(cacheDir, `${targetBuild.buildId}.7z`)

    if (existsSync(archivePath)) {
      log(`Using cached download: ${archivePath}`)
      onProgress && onProgress(75)
    } else {
      log(`Downloading from: ${downloadUrl}`)
      onProgress && onProgress(25)

      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 300000,
        headers: buildAuthHeaders(server)
      })

      const totalLength = parseInt(response.headers['content-length'] || '0', 10)
      let downloaded = 0

      await new Promise((resolve, reject) => {
        const writer = createWriteStream(archivePath)
        response.data.on('data', (chunk) => {
          downloaded += chunk.length
          if (totalLength > 0) {
            const pct = 25 + Math.floor((downloaded / totalLength) * 50)
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
    }

    if (job.cancelled) return { status: 'cancelled' }

    log('Download complete. Verifying archive...')
    onProgress && onProgress(80)

    log('Applying update to server directory...')
    onProgress && onProgress(90)

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

    log(`✓ Update complete! Now on build ${targetBuild.buildId}`)
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
