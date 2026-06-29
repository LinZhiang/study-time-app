import type { StaminaManualStars } from '../types/dailyStars'
import { DAILY_STAMINA_STORAGE_KEY } from '../types/dailyStars'
import { getTodayKey } from './scheduleStorage'
import { logStaminaAdjust } from './activityLog'

interface DailyStaminaRecord {
  date: string
  manualStars: StaminaManualStars
}

function createEmptyRecord(date = getTodayKey()): DailyStaminaRecord {
  return { date, manualStars: 0 }
}

function loadRawRecord(): DailyStaminaRecord {
  try {
    const raw = localStorage.getItem(DAILY_STAMINA_STORAGE_KEY)
    if (!raw) return createEmptyRecord()
    const data = JSON.parse(raw) as DailyStaminaRecord
    const manualStars = data.manualStars === 1 || data.manualStars === -1 ? data.manualStars : 0
    if (data.date !== getTodayKey()) return createEmptyRecord()
    return { date: getTodayKey(), manualStars }
  } catch {
    return createEmptyRecord()
  }
}

function saveRecord(record: DailyStaminaRecord) {
  localStorage.setItem(DAILY_STAMINA_STORAGE_KEY, JSON.stringify(record))
}

export function loadTodayStaminaManual(): StaminaManualStars {
  return loadRawRecord().manualStars
}

export function setTodayStaminaManual(manualStars: StaminaManualStars) {
  saveRecord({ date: getTodayKey(), manualStars })
  logStaminaAdjust(manualStars)
}

export function readStaminaManualForDate(date: string): StaminaManualStars {
  try {
    const raw = localStorage.getItem(DAILY_STAMINA_STORAGE_KEY)
    if (!raw) return 0
    const data = JSON.parse(raw) as DailyStaminaRecord
    if (data.date !== date) return 0
    return data.manualStars === 1 || data.manualStars === -1 ? data.manualStars : 0
  } catch {
    return 0
  }
}

export function resetStaminaForToday(today = getTodayKey()) {
  saveRecord({ date: today, manualStars: 0 })
}
