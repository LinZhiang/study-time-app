import type { DailyLaborRecord, LaborCategory, LaborEntry } from '../types/labor'
import { DAILY_LABOR_STORAGE_KEY } from '../types/labor'
import type { DayPeriod } from '../types/schedule'
import { getTodayKey } from './scheduleStorage'
import { logLaborRecord } from './activityLog'

function createEmptyRecord(date = getTodayKey()): DailyLaborRecord {
  return { date, totalSeconds: 0, entries: [] }
}

function loadRawRecord(): DailyLaborRecord {
  try {
    const raw = localStorage.getItem(DAILY_LABOR_STORAGE_KEY)
    if (!raw) return createEmptyRecord()
    const data = JSON.parse(raw) as DailyLaborRecord
    if (data.date !== getTodayKey()) return createEmptyRecord()
    return {
      date: getTodayKey(),
      totalSeconds: data.totalSeconds ?? 0,
      entries: Array.isArray(data.entries) ? data.entries : [],
    }
  } catch {
    return createEmptyRecord()
  }
}

function saveRecord(record: DailyLaborRecord) {
  localStorage.setItem(DAILY_LABOR_STORAGE_KEY, JSON.stringify(record))
}

export function loadTodayLaborRecord(): DailyLaborRecord {
  return loadRawRecord()
}

export function appendLaborEntry(input: {
  category: LaborCategory
  durationSeconds: number
  startedAt: number
  endedAt: number
  period: DayPeriod
}) {
  const record = loadRawRecord()
  const entry: LaborEntry = {
    id: `${input.endedAt}-${Math.random().toString(36).slice(2, 8)}`,
    category: input.category,
    durationSeconds: input.durationSeconds,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    period: input.period,
  }
  record.entries.unshift(entry)
  record.totalSeconds += input.durationSeconds
  saveRecord(record)
  logLaborRecord(entry)
  return entry
}

export function formatLaborDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h} 小时 ${m} 分`
  if (m > 0) return `${m} 分 ${s} 秒`
  return `${s} 秒`
}

export function formatLaborClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
