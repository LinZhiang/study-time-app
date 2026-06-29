import type { DailyCleanlinessRecord } from '../types/cleanliness'
import { DAILY_CLEANLINESS_STORAGE_KEY } from '../types/cleanliness'
import { getTodayKey } from './scheduleStorage'
import { shouldTrackStatistics } from './pausePeriod'
import { logCleanlinessMark } from './activityLog'

function createEmptyRecord(date = getTodayKey()): DailyCleanlinessRecord {
  return { date, maintained: false }
}

function loadRawRecord(): DailyCleanlinessRecord {
  try {
    const raw = localStorage.getItem(DAILY_CLEANLINESS_STORAGE_KEY)
    if (!raw) return createEmptyRecord()
    const data = JSON.parse(raw) as DailyCleanlinessRecord
    if (data.date !== getTodayKey()) return createEmptyRecord()
    return { date: getTodayKey(), maintained: !!data.maintained }
  } catch {
    return createEmptyRecord()
  }
}

function saveRecord(record: DailyCleanlinessRecord) {
  localStorage.setItem(DAILY_CLEANLINESS_STORAGE_KEY, JSON.stringify(record))
}

export function loadTodayCleanliness(): DailyCleanlinessRecord {
  return loadRawRecord()
}

export function setTodayCleanlinessMaintained(maintained: boolean) {
  if (!shouldTrackStatistics()) return
  saveRecord({ date: getTodayKey(), maintained })
  logCleanlinessMark(maintained)
}

export function readCleanlinessForDate(date: string): DailyCleanlinessRecord {
  try {
    const raw = localStorage.getItem(DAILY_CLEANLINESS_STORAGE_KEY)
    if (!raw) return createEmptyRecord(date)
    const data = JSON.parse(raw) as DailyCleanlinessRecord
    if (data.date !== date) return createEmptyRecord(date)
    return { date, maintained: !!data.maintained }
  } catch {
    return createEmptyRecord(date)
  }
}

export function calculateCleanlinessStars(maintained: boolean): number {
  return maintained ? 1 : 0
}

export function resetCleanlinessForToday(today = getTodayKey()) {
  saveRecord(createEmptyRecord(today))
}
