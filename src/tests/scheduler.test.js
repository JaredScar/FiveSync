import { describe, it, expect } from 'vitest'

// Tests for the cron expression builder logic (extracted as a pure function for testability)

const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

function buildCronExpression(schedule) {
  const [hour, minute] = (schedule.update_time || '03:00').split(':').map(Number)
  const type = schedule.schedule_type

  if (type === 'daily') return `${minute} ${hour} * * *`

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

  if (type === 'monthly') return `${minute} ${hour} 1 * *`

  return null
}

describe('buildCronExpression', () => {
  it('builds correct daily cron expression', () => {
    expect(buildCronExpression({ schedule_type: 'daily', update_time: '03:00' })).toBe('0 3 * * *')
  })

  it('builds correct weekly cron expression for specific days', () => {
    const expr = buildCronExpression({
      schedule_type: 'weekly',
      update_time: '04:30',
      days: ['mon', 'wed', 'fri']
    })
    expect(expr).toBe('30 4 * * 1,3,5')
  })

  it('handles JSON string days', () => {
    const expr = buildCronExpression({
      schedule_type: 'weekly',
      update_time: '02:00',
      days: '["mon","fri"]'
    })
    expect(expr).toBe('0 2 * * 1,5')
  })

  it('builds monthly cron expression', () => {
    expect(buildCronExpression({ schedule_type: 'monthly', update_time: '05:00' })).toBe('0 5 1 * *')
  })

  it('returns null for weekly with no days', () => {
    expect(buildCronExpression({ schedule_type: 'weekly', update_time: '03:00', days: [] })).toBeNull()
  })

  it('uses default time when update_time is missing', () => {
    expect(buildCronExpression({ schedule_type: 'daily' })).toBe('0 3 * * *')
  })

  it('handles midnight correctly', () => {
    expect(buildCronExpression({ schedule_type: 'daily', update_time: '00:00' })).toBe('0 0 * * *')
  })
})
