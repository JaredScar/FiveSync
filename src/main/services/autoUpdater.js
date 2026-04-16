import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'

let getMainWindowFn = null

export function initAutoUpdater(getWindowFn) {
  getMainWindowFn = getWindowFn

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    notify({ type: 'checking-for-update' })
  })

  autoUpdater.on('update-available', (info) => {
    notify({ type: 'update-available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    notify({ type: 'update-not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    notify({ type: 'download-progress', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    notify({ type: 'update-downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    notify({ type: 'update-error', message: err.message })
  })

  ipcMain.handle('app-update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, updateInfo: result?.updateInfo || null }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('app-update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('app-update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

function notify(payload) {
  const win = getMainWindowFn && getMainWindowFn()
  if (win && !win.isDestroyed()) {
    win.webContents.send('app-update-event', payload)
  }
}
