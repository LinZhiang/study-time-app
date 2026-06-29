import type { PausePeriod } from '../types/pausePeriod'
import { PAUSE_PERIODS_STORAGE_KEY } from '../types/pausePeriod'
import { getTodayKey } from './scheduleStorage'

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadPausePeriods(): PausePeriod[] {
  try {
    const raw = localStorage.getItem(PAUSE_PERIODS_STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as PausePeriod[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function savePausePeriods(periods: PausePeriod[]) {
  localStorage.setItem(
    PAUSE_PERIODS_STORAGE_KEY,
    JSON.stringify(periods.sort((a, b) => b.startDate.localeCompare(a.startDate))),
  )
}

export function listPausePeriods(): PausePeriod[] {
  return loadPausePeriods()
}

export function isDatePaused(date: string): boolean {
  return loadPausePeriods().some(
    (period) => date >= period.startDate && date <= period.endDate,
  )
}

export function isTodayPaused(): boolean {
  return isDatePaused(getTodayKey())
}

export function shouldTrackStatistics(date = getTodayKey()): boolean {
  return !isDatePaused(date)
}

export function getPausePeriodForDate(date: string): PausePeriod | null {
  return (
    loadPausePeriods().find(
      (period) => date >= period.startDate && date <= period.endDate,
    ) ?? null
  )
}

export function addPausePeriod(input: {
  startDate: string
  endDate: string
  note?: string
}): PausePeriod {
  const startDate = input.startDate <= input.endDate ? input.startDate : input.endDate
  const endDate = input.startDate <= input.endDate ? input.endDate : input.startDate
  const period: PausePeriod = {
    id: generateId(),
    startDate,
    endDate,
    note: input.note?.trim() || undefined,
    createdAt: Date.now(),
  }
  savePausePeriods([period, ...loadPausePeriods()])
  return period
}

export function removePausePeriod(id: string) {
  savePausePeriods(loadPausePeriods().filter((period) => period.id !== id))
}

export function countDaysInPeriod(period: PausePeriod) {
  const [sy, sm, sd] = period.startDate.split('-').map(Number)
  const [ey, em, ed] = period.endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd)
  const end = new Date(ey, em - 1, ed)
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}

export function formatPausePeriodLabel(period: PausePeriod) {
  if (period.startDate === period.endDate) {
    return formatPauseDateLabel(period.startDate)
  }
  return `${formatPauseDateLabel(period.startDate)} 至 ${formatPauseDateLabel(period.endDate)}`
}

export function formatPauseDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${y}年${m}月${d}日 周${weekday}`
}
