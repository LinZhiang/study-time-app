import type { DailyExerciseRecord } from '../types/exercise'
import { DAILY_EXERCISE_STORAGE_KEY } from '../types/exercise'
import type { DailyLaborRecord } from '../types/labor'
import { DAILY_LABOR_STORAGE_KEY } from '../types/labor'
import type {
  DailyStarBreakdown,
  DailyStarsArchiveEntry,
  DailyStarsDisplayState,
} from '../types/dailyStars'
import {
  DAILY_STARS_ARCHIVE_KEY,
  DAILY_STARS_START_DATE,
} from '../types/dailyStars'
import type { ScheduleState } from '../types/schedule'
import { SCHEDULE_STORAGE_KEY } from '../types/schedule'
import { calculateDailyStars, calculateStaminaAutoStars } from './dailyStars'
import { finalizeDayLog, isDayLogFinalized } from './activityLog'
import { createDefaultState, saveScheduleState } from './scheduleStorage'
import { readCleanlinessForDate, resetCleanlinessForToday } from './cleanlinessRecord'
import {
  buildMoneySpendSnapshot,
  readMoneySpendForDate,
  resetMoneySpendForToday,
  syncMoneyWallet,
} from './moneySpendRecord'
import { readStaminaManualForDate, resetStaminaForToday } from './staminaRecord'
import { getTodayKey, getYesterdayKey } from './scheduleStorage'

function readRawLabor(): DailyLaborRecord | null {
  try {
    const raw = localStorage.getItem(DAILY_LABOR_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DailyLaborRecord
  } catch {
    return null
  }
}

function readRawExercise(): DailyExerciseRecord | null {
  try {
    const raw = localStorage.getItem(DAILY_EXERCISE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DailyExerciseRecord
  } catch {
    return null
  }
}

function readRawSchedule(): ScheduleState | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScheduleState
  } catch {
    return null
  }
}

function loadArchiveMap(): Record<string, DailyStarsArchiveEntry> {
  try {
    const raw = localStorage.getItem(DAILY_STARS_ARCHIVE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, DailyStarsArchiveEntry>
  } catch {
    return {}
  }
}

function saveArchiveMap(map: Record<string, DailyStarsArchiveEntry>) {
  localStorage.setItem(DAILY_STARS_ARCHIVE_KEY, JSON.stringify(map))
}

function resetLaborRecordForToday(today = getTodayKey()) {
  localStorage.setItem(
    DAILY_LABOR_STORAGE_KEY,
    JSON.stringify({ date: today, totalSeconds: 0, entries: [] }),
  )
}

function resetExerciseRecordForToday(today = getTodayKey()) {
  localStorage.setItem(
    DAILY_EXERCISE_STORAGE_KEY,
    JSON.stringify({ date: today, totalSeconds: 0, totalCalories: 0, entries: [] }),
  )
}

function resolvePendingDate() {
  const today = getTodayKey()
  const labor = readRawLabor()
  const exercise = readRawExercise()
  const schedule = readRawSchedule()

  const candidates = [labor?.date, exercise?.date, schedule?.date].filter(
    (date): date is string => !!date && date !== today,
  )
  if (candidates.length === 0) return null

  return candidates.sort().at(-1) ?? null
}

function collectTotalsForDate(date: string) {
  const labor = readRawLabor()
  const exercise = readRawExercise()
  const schedule = readRawSchedule()

  return {
    date,
    laborSeconds: labor?.date === date ? labor.totalSeconds ?? 0 : 0,
    exerciseDurationSeconds: exercise?.date === date ? exercise.totalSeconds ?? 0 : 0,
    exerciseCalories: exercise?.date === date ? exercise.totalCalories ?? 0 : 0,
    studySeconds: schedule?.date === date ? schedule.studySeconds ?? 0 : 0,
  }
}

function saveArchivedBreakdown(date: string, breakdown: DailyStarBreakdown) {
  const map = loadArchiveMap()
  map[date] = { date, breakdown }
  saveArchiveMap(map)
}

export function getArchivedDailyStars(date: string): DailyStarBreakdown | null {
  const breakdown = loadArchiveMap()[date]?.breakdown
  if (!breakdown) return null
  return normalizeBreakdown(breakdown)
}

function normalizeBreakdown(breakdown: DailyStarBreakdown): DailyStarBreakdown {
  const staminaManualStars = breakdown.staminaManualStars ?? 0
  const staminaAutoStars =
    breakdown.staminaAutoStars ?? calculateStaminaAutoStars(breakdown.exerciseCalories)
  const staminaStars = breakdown.staminaStars ?? staminaAutoStars + staminaManualStars
  const moneyWalletBalance = breakdown.moneyWalletBalance ?? 0
  const moneyDailyIncrement = breakdown.moneyDailyIncrement ?? 50
  const moneySpent = breakdown.moneySpent ?? 0
  const moneyHasSpending = breakdown.moneyHasSpending ?? false
  const moneySubmitted = breakdown.moneySubmitted ?? false
  const cleanlinessMaintained = breakdown.cleanlinessMaintained ?? false
  const cleanlinessStars = breakdown.cleanlinessStars ?? (cleanlinessMaintained ? 1 : 0)
  return {
    ...breakdown,
    staminaManualStars,
    staminaAutoStars,
    staminaStars,
    moneyWalletBalance,
    moneyDailyIncrement,
    moneySpent,
    moneyHasSpending,
    moneySubmitted,
    cleanlinessMaintained,
    cleanlinessStars,
    totalStars:
      breakdown.laborStars +
      breakdown.exerciseStars +
      breakdown.perseveranceStars +
      staminaStars +
      cleanlinessStars,
  }
}

/** 跨日时归档昨日数据并结算星级（6 月 29 日及以前不写入星级） */
function hasPendingDayBeenFinalized(pendingDate: string) {
  if (isDayLogFinalized(pendingDate)) return true
  if (pendingDate >= DAILY_STARS_START_DATE && getArchivedDailyStars(pendingDate)) return true
  return false
}

function rolloverScheduleStorageIfStale(pendingDate: string) {
  const schedule = readRawSchedule()
  if (schedule?.date === pendingDate) {
    saveScheduleState(createDefaultState())
  }
}

export function finalizePreviousDayIfNeeded() {
  const today = getTodayKey()
  const pendingDate = resolvePendingDate()
  if (!pendingDate) return
  if (hasPendingDayBeenFinalized(pendingDate)) return

  const totals = collectTotalsForDate(pendingDate)
  const moneyRecord = readMoneySpendForDate(pendingDate)
  let starsBreakdown: DailyStarBreakdown | undefined
  if (pendingDate >= DAILY_STARS_START_DATE) {
    syncMoneyWallet(pendingDate)
    starsBreakdown = calculateDailyStars({
      ...totals,
      manualStaminaStars: readStaminaManualForDate(pendingDate),
      cleanlinessMaintained: readCleanlinessForDate(pendingDate).maintained,
      money: buildMoneySpendSnapshot(pendingDate, moneyRecord),
    })
    saveArchivedBreakdown(pendingDate, starsBreakdown)
  }

  finalizeDayLog(pendingDate, starsBreakdown)
  rolloverScheduleStorageIfStale(pendingDate)

  resetLaborRecordForToday(today)
  resetExerciseRecordForToday(today)
  resetStaminaForToday(today)
  resetMoneySpendForToday(today)
  resetCleanlinessForToday(today)
  syncMoneyWallet(today)
}

export function getDailyStarsDisplayState(): DailyStarsDisplayState {
  finalizePreviousDayIfNeeded()

  const today = getTodayKey()
  if (today < DAILY_STARS_START_DATE) {
    return { status: 'before_start', startDate: DAILY_STARS_START_DATE }
  }

  const yesterday = getYesterdayKey(today)
  if (yesterday >= DAILY_STARS_START_DATE) {
    const breakdown = getArchivedDailyStars(yesterday)
    if (breakdown) {
      return { status: 'ready', date: yesterday, breakdown }
    }
  }

  return { status: 'waiting_day_end', todayKey: today }
}

export function setupDailyStarsSync() {
  finalizePreviousDayIfNeeded()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') finalizePreviousDayIfNeeded()
  })
}

export function formatDailyStarsStartDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return `${y}年${m}月${d}日`
}

export function formatArchivedDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${y}年${m}月${d}日 周${weekday}`
}
