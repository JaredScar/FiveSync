import { contextBridge, ipcRenderer } from 'electron'

const api = {
  servers: {
    list: () => ipcRenderer.invoke('servers:list'),
    get: (id) => ipcRenderer.invoke('servers:get', id),
    create: (data) => ipcRenderer.invoke('servers:create', data),
    update: (id, data) => ipcRenderer.invoke('servers:update', id, data),
    delete: (id) => ipcRenderer.invoke('servers:delete', id),
    scan: (id) => ipcRenderer.invoke('server:scan', id)
  },
  artifact: {
    check: (serverId) => ipcRenderer.invoke('artifact:check', serverId),
    builds: () => ipcRenderer.invoke('artifact:builds')
  },
  sync: {
    start: (serverId) => ipcRenderer.invoke('sync:start', serverId),
    cancel: (serverId) => ipcRenderer.invoke('sync:cancel', serverId),
    status: (serverId) => ipcRenderer.invoke('sync:status', serverId),
    rollback: (serverId, targetBuild) => ipcRenderer.invoke('sync:rollback', serverId, targetBuild)
  },
  schedule: {
    get: (serverId) => ipcRenderer.invoke('schedule:get', serverId),
    save: (serverId, data) => ipcRenderer.invoke('schedule:save', serverId, data)
  },
  history: {
    list: (serverId) => ipcRenderer.invoke('history:list', serverId)
  },
  shell: {
    open: (url) => ipcRenderer.invoke('shell:open', url)
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder')
  },
  appUpdate: {
    check: () => ipcRenderer.invoke('app-update:check'),
    download: () => ipcRenderer.invoke('app-update:download'),
    install: () => ipcRenderer.invoke('app-update:install')
  },
  on: (channel, callback) => {
    const channels = ['sync-progress', 'sync-log', 'sync-complete', 'sync-error', 'scheduler-event', 'app-update-event']
    if (channels.includes(channel)) {
      const sub = (_, ...args) => callback(...args)
      ipcRenderer.on(channel, sub)
      return () => ipcRenderer.removeListener(channel, sub)
    }
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  }
}

contextBridge.exposeInMainWorld('api', api)
