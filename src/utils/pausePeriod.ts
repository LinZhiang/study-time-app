import type { PausePeriod } from '../types/pausePeriod'
import { PAUSE_PERIODS_STORAGE_KEY } from '../types/pausePeriod'
import type { ScheduleState } from '../types/schedule'
import { getTodayKey, resolvePauseDayPeriodByClock } from './scheduleStorage'

export const PAUSE_PERIODS_UPDATED_EVENT = 'pause-periods-updated'

const PAUSE_DAY_STUDY_SECONDS = 40 * 60

export function notifyPausePeriodsUpdated() {
  window.dispatchEvent(new CustomEvent(PAUSE_PERIODS_UPDATED_EVENT))
}

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

/** 加载或切换日期后，把休整日从 before_morning 等状态切到全天番茄模式 */
export function applyPauseDaySchedulePatch(state: ScheduleState): boolean {
  const today = getTodayKey()
  if (!isDatePaused(today) || state.date !== today) return false

  state.morningActivated = true

  if (state.activity === 'exercise') return true

  if (
    state.activity === 'pomodoro' &&
    (state.pomodoroPhase === 'studying' ||
      state.pomodoroPhase === 'resting' ||
      state.pomodoroPhase === 'studyDone')
  ) {
    return true
  }

  const period = resolvePauseDayPeriodByClock()
  const needsReset =
    state.activity === 'before_morning' ||
    state.activity === 'waiting_meal' ||
    state.activity === 'free_hour' ||
    state.activity === 'free_hour_prompt' ||
    state.activity === 'labor' ||
    state.activity === 'mid_break' ||
    state.activity === 'relaxed_pomodoro' ||
    state.activity === 'night_rest_timer' ||
    state.activity === 'sleep_prompt' ||
    state.dayPeriod === 'noon' ||
    state.dayPeriod === 'night_rest' ||
    state.dayPeriod === 'sleep'

  if (needsReset) {
    state.timerDeadlineAt = null
    state.dayPeriod = period
    state.activity = 'pomodoro'
    state.pomodoroPhase = 'idle'
    state.pomodoroRemaining = PAUSE_DAY_STUDY_SECONDS
    state.activePomodoroPeriod = null
    state.currentPomodoroRound = 0
    state.pausedStudyRemaining = 0
    state.studySegmentStartedAt = null
    return true
  }

  if (
    state.activity === 'pomodoro' &&
    (state.pomodoroPhase === 'idle' || state.pomodoroPhase === 'restDone')
  ) {
    state.dayPeriod = period
    return true
  }

  return true
}

/** 完整日程统计（劳动、星级、学习时长等） */
export function shouldTrackFullStatistics(date = getTodayKey()): boolean {
  return !isDatePaused(date)
}

/** 兼容旧名：仅完整统计日返回 true */
export function shouldTrackStatistics(date = getTodayKey()): boolean {
  return shouldTrackFullStatistics(date)
}

/** 休整日仍统计番茄轮数 */
export function shouldTrackPomodoroStatistics(): boolean {
  return true
}

/** 休整日仍统计锻炼 */
export function shouldTrackExerciseStatistics(): boolean {
  return true
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
  notifyPausePeriodsUpdated()
  return period
}

export function removePausePeriod(id: string) {
  savePausePeriods(loadPausePeriods().filter((period) => period.id !== id))
  notifyPausePeriodsUpdated()
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
