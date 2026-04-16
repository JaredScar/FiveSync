import React, { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './pages/Dashboard'
import Schedule from './pages/Schedule'
import Settings from './pages/Settings'
import AddServerModal from './components/AddServerModal'
import ToastContainer from './components/ToastContainer'
import AppUpdateBanner from './components/AppUpdateBanner'
import { useStore } from './store'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const {
    servers, setServers, activeServerId, setActiveServerId,
    setSyncState, setArtifactInfo, setHistory,
    showAddServer, addToast
  } = useStore()

  useEffect(() => {
    loadServers()
  }, [])

  useEffect(() => {
    if (!activeServerId && servers.length > 0) {
      setActiveServerId(servers[0].id)
    }
  }, [servers])

  useEffect(() => {
    const unsub1 = window.api.on('sync-progress', ({ serverId, progress }) => {
      setSyncState(serverId, (prev) => ({ ...prev, running: true, progress }))
    })
    const unsub2 = window.api.on('sync-log', ({ serverId, line }) => {
      setSyncState(serverId, (prev) => ({
        ...prev,
        logs: [...(prev?.logs || []), line]
      }))
    })
    const unsub3 = window.api.on('sync-complete', ({ serverId, result }) => {
      setSyncState(serverId, { running: false, progress: 100 })
      loadServers()
      if (result?.status === 'success') {
        addToast({ type: 'success', message: `Server updated to build ${result.build}` })
        refreshArtifact(serverId)
        refreshHistory(serverId)
      } else if (result?.status === 'up_to_date') {
        addToast({ type: 'info', message: 'Server is already up to date' })
      }
    })
    const unsub4 = window.api.on('sync-error', ({ serverId, error }) => {
      setSyncState(serverId, { running: false, progress: 0, error })
      addToast({ type: 'error', message: `Sync failed: ${error}` })
    })
    return () => {
      unsub1 && unsub1()
      unsub2 && unsub2()
      unsub3 && unsub3()
      unsub4 && unsub4()
    }
  }, [])

  async function loadServers() {
    const list = await window.api.servers.list()
    setServers(list)
  }

  async function refreshArtifact(serverId) {
    const info = await window.api.artifact.check(serverId)
    setArtifactInfo(serverId, info)
  }

  async function refreshHistory(serverId) {
    const hist = await window.api.history.list(serverId)
    setHistory(serverId, hist)
  }

  const activeServer = servers.find((s) => s.id === activeServerId) || servers[0]

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header server={activeServer} onSyncNow={() => handleSyncNow(activeServer?.id)} />
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-app)' }}>
          {page === 'dashboard' && <Dashboard onRefreshArtifact={refreshArtifact} onRefreshHistory={refreshHistory} />}
          {page === 'schedule' && <Schedule />}
          {page === 'settings' && <Settings onDeleteServer={handleDeleteServer} onSaveSettings={loadServers} />}
        </main>
      </div>
      {showAddServer && <AddServerModal onClose={() => useStore.getState().setShowAddServer(false)} onCreated={loadServers} />}
      <ToastContainer />
      <AppUpdateBanner />
    </div>
  )

  async function handleSyncNow(serverId) {
    if (!serverId) return
    const state = useStore.getState().syncState[serverId]
    if (state?.running) return
    setSyncState(serverId, { running: true, progress: 0, logs: [] })
    await window.api.sync.start(serverId)
  }

  async function handleDeleteServer(serverId) {
    await window.api.servers.delete(serverId)
    await loadServers()
    setActiveServerId(null)
    setPage('dashboard')
    addToast({ type: 'success', message: 'Server deleted' })
  }
}
