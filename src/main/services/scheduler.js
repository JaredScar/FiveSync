import cron from 'node-cron'
import { getServers, getSchedule } from './db'
import { runSyncJob } from './syncEngine'

const scheduledTasks = new Map()
let getMainWindowFn = null

const DAY_MAP = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
}

export function initScheduler(getWindowFn) {
  getMainWindowFn = getWindowFn
  refreshAllSchedules()
}

export function refreshAllSchedules() {
  const servers = getServers()
  for (const server of servers) {
    refreshServerSchedule(server.id)
  }
}

export function refreshServerSchedule(serverId) {
  if (scheduledTasks.has(serverId)) {
    scheduledTasks.get(serverId).destroy()
    scheduledTasks.delete(serverId)
  }

  const schedule = getSchedule(serverId)
  if (!schedule || !schedule.enabled) return

  const cronExpr = buildCronExpression(schedule)
  if (!cronExpr) return

  try {
    const task = cron.schedule(cronExpr, async () => {
      notifyRenderer({ type: 'sync-started', serverId })
      try {
        const result = await runSyncJob(
          serverId,
          (pct) => notifyRenderer({ type: 'sync-progress', serverId, progress: pct }),
          (line) => notifyRenderer({ type: 'sync-log', serverId, line })
        )
        notifyRenderer({ type: 'sync-complete', serverId, result })
      } catch (err) {
        notifyRenderer({ type: 'sync-error', serverId, error: err.message })
      }
    })
    scheduledTasks.set(serverId, task)
  } catch (e) {
    console.error(`Failed to schedule server ${serverId}:`, e.message)
  }
}

function buildCronExpression(schedule) {
  const [hour, minute] = (schedule.update_time || '03:00').split(':').map(Number)
  const type = schedule.schedule_type

  if (type === 'daily') {
    return `${minute} ${hour} * * *`
  }

  if (type === 'weekly') {
    let days
    try {
      days = typeof schedule.days === 'string' ? JSON.parse(schedule.days) : schedule.days
    } catch {
      days = ['mon', 'wed', 'fri']
    }
    if (!days || days.length === 0) return null
    const dayNums = days.map((d) => DAY_MAP[d.toLowerCase()]).filter((n) => n !== undefined)
    if (dayNums.length === 0) return null
    return `${minute} ${hour} * * ${dayNums.join(',')}`
  }

  if (type === 'monthly') {
    return `${minute} ${hour} 1 * *`
  }

  return null
}

function notifyRenderer(payload) {
  const win = getMainWindowFn && getMainWindowFn()
  if (win && !win.isDestroyed()) {
    win.webContents.send('scheduler-event', payload)
  }
}

export function stopAllSchedules() {
  for (const task of scheduledTasks.values()) {
    task.destroy()
  }
  scheduledTasks.clear()
}
