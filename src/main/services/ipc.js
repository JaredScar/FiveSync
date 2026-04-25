import { ipcMain, shell, dialog } from 'electron'
import {
  getServers,
  getServer,
  createServer,
  updateServer,
  deleteServer,
  getSchedule,
  upsertSchedule,
  getUpdateHistory
} from './db'
import { getLatestBuild, fetchRemoteBuildList, compareBuildNumbers } from './connector'
import { runSyncJob, getActiveJob, cancelJob } from './syncEngine'
import { refreshServerSchedule } from './scheduler'
import { detectInstalledBuild, isServerProcessRunning } from './serverStatus'
import { listRunningProcesses } from './processControl'

export function registerIpcHandlers() {
  ipcMain.handle('servers:list', async () => {
    return getServers()
  })

  ipcMain.handle('servers:get', async (_, id) => {
    return getServer(id)
  })

  ipcMain.handle('servers:create', async (_, data) => {
    const server = createServer(data)
    refreshServerSchedule(server.id)
    return server
  })

  ipcMain.handle('servers:update', async (_, id, data) => {
    const server = updateServer(id, data)
    return server
  })

  ipcMain.handle('servers:delete', async (_, id) => {
    deleteServer(id)
    return { success: true }
  })

  ipcMain.handle('artifact:check', async (_, serverId) => {
    try {
      const server = getServer(serverId)
      if (!server) return { error: 'Server not found' }

      // Auto-detect installed build from disk if DB value is missing
      if (!server.current_build) {
        const detected = detectInstalledBuild(server.path)
        if (detected) {
          updateServer(serverId, { current_build: detected })
          server.current_build = detected
        }
      }

      const latest = await getLatestBuild()
      if (!latest) return {
        error: 'Could not reach runtime.fivem.net — check your internet connection',
        currentBuild: server.current_build
      }

      const diff = compareBuildNumbers(server.current_build, latest.buildId)
      return {
        currentBuild: server.current_build,
        latestBuild: latest.buildId,
        latestBuildNumber: latest.buildNumber,
        versionsBehind: diff !== null ? Math.max(0, diff) : null,
        upToDate: diff !== null ? diff <= 0 : false,
        checkedAt: new Date().toISOString(),
        feedUrl: 'https://runtime.fivem.net/artifacts/fivem/build_server_windows/master/'
      }
    } catch (err) {
      return { error: err.message }
    }
  })

  // Scan a server directory: detect installed build + check if process is running
  ipcMain.handle('server:scan', async (_, serverId) => {
    try {
      const server = getServer(serverId)
      if (!server) return { error: 'Server not found' }

      const detectedBuild = detectInstalledBuild(server.path)
      const running = isServerProcessRunning(server)

      // Persist detected build back to DB if it differs
      if (detectedBuild && detectedBuild !== server.current_build) {
        updateServer(serverId, { current_build: detectedBuild })
      }

      return { detectedBuild, running, serverId }
    } catch (err) {
      return { error: err.message, running: false, detectedBuild: null }
    }
  })

  ipcMain.handle('sync:start', async (event, serverId) => {
    const sender = event.sender
    try {
      const result = await runSyncJob(
        serverId,
        (progress) => {
          if (!sender.isDestroyed()) sender.send('sync-progress', { serverId, progress })
        },
        (line) => {
          if (!sender.isDestroyed()) sender.send('sync-log', { serverId, line })
        }
      )
      if (!sender.isDestroyed()) sender.send('sync-complete', { serverId, result })
      return result
    } catch (err) {
      if (!sender.isDestroyed()) sender.send('sync-error', { serverId, error: err.message })
      return { status: 'error', error: err.message }
    }
  })

  ipcMain.handle('sync:cancel', async (_, serverId) => {
    cancelJob(serverId)
    return { success: true }
  })

  ipcMain.handle('sync:rollback', async (event, serverId, targetBuild) => {
    const sender = event.sender
    try {
      const result = await runSyncJob(
        serverId,
        (progress) => {
          if (!sender.isDestroyed()) sender.send('sync-progress', { serverId, progress })
        },
        (line) => {
          if (!sender.isDestroyed()) sender.send('sync-log', { serverId, line })
        },
        { force: true, targetBuild }
      )
      if (!sender.isDestroyed()) sender.send('sync-complete', { serverId, result })
      return result
    } catch (err) {
      if (!sender.isDestroyed()) sender.send('sync-error', { serverId, error: err.message })
      return { status: 'error', error: err.message }
    }
  })

  ipcMain.handle('artifact:builds', async () => {
    try {
      const builds = await fetchRemoteBuildList()
      return { builds: builds.slice(0, 50) }
    } catch (err) {
      return { error: err.message, builds: [] }
    }
  })

  ipcMain.handle('sync:status', async (_, serverId) => {
    return getActiveJob(serverId)
  })

  ipcMain.handle('schedule:get', async (_, serverId) => {
    return getSchedule(serverId)
  })

  ipcMain.handle('schedule:save', async (_, serverId, data) => {
    const schedule = upsertSchedule(serverId, data)
    refreshServerSchedule(serverId)
    return schedule
  })

  ipcMain.handle('history:list', async (_, serverId) => {
    return getUpdateHistory(serverId)
  })

  ipcMain.handle('shell:open', async (_, url) => {
    shell.openExternal(url)
  })

  ipcMain.handle('dialog:openFolder', async (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select FiveM Server Folder'
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('dialog:openFile', async (event, options = {}) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: options.title || 'Select script or executable',
      filters: options.filters || [
        { name: 'Server launcher', extensions: ['bat', 'cmd', 'exe', 'ps1', 'sh'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('processes:list', async () => {
    try {
      return { processes: listRunningProcesses() }
    } catch (err) {
      return { processes: [], error: err.message }
    }
  })
}
