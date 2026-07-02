import type { DayPeriod, ScheduleState } from '../types/schedule'
import { SCHEDULE_STORAGE_KEY } from '../types/schedule'

export function getTodayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getDateKeyOffset(dateKey: string, offsetDays: number) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + offsetDays)
  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

export function getYesterdayKey(from = getTodayKey()) {
  return getDateKeyOffset(from, -1)
}

export function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 进入中午模式所需的最少番茄数（达到后可切换，不限制继续学习） */
export const MORNING_NOON_MIN = 2
/** 进入晚上模式所需的最少番茄数 */
export const AFTERNOON_EVENING_MIN = 4
/** 进入休息模式所需的最少番茄数 */
export const EVENING_REST_MIN = 2

export function createDefaultState(): ScheduleState {
  return {
    date: getTodayKey(),
    dayPeriod: 'morning',
    activity: 'before_morning',
    morningCount: 0,
    afternoonCount: 0,
    eveningCount: 0,
    exerciseSeconds: 0,
    laborSeconds: 0,
    studySeconds: 0,
    freeHourRemaining: null,
    freeHourPromptShown: false,
    nightRestRemaining: null,
    morningActivated: false,
    activePomodoroPeriod: null,
    currentPomodoroRound: 0,
    pomodoroPhase: 'idle',
    pomodoroRemaining: 40 * 60,
    pausedStudyRemaining: 0,
    midBreakUsedSeconds: 0,
    relaxedPomodoroRemaining: null,
    timerDeadlineAt: null,
    midBreakSegmentStartedAt: null,
    midBreakSegmentBaseSeconds: 0,
    exerciseSegmentStartedAt: null,
    exerciseSegmentBaseSeconds: 0,
    studySegmentStartedAt: null,
    studySegmentBaseSeconds: 0,
    laborSegmentStartedAt: null,
    laborSegmentBaseSeconds: 0,
    laborCategory: null,
    laborResumeActivity: null,
    laborResumeFreeHourRemaining: null,
    laborResumeFreeHourPromptShown: false,
    laborResumeNightRestRemaining: null,
    laborResumePomodoroPhase: null,
    laborResumePomodoroRemaining: null,
    countdownEndingReminderKey: null,
  }
}

export function loadScheduleState(): ScheduleState {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY)
    if (!raw) return createDefaultState()
    const data = JSON.parse(raw) as ScheduleState
    if (data.date !== getTodayKey()) return createDefaultState()
    return {
      ...createDefaultState(),
      ...data,
      pausedStudyRemaining: data.pausedStudyRemaining ?? 0,
      midBreakUsedSeconds: data.midBreakUsedSeconds ?? 0,
      relaxedPomodoroRemaining: data.relaxedPomodoroRemaining ?? null,
      timerDeadlineAt: data.timerDeadlineAt ?? null,
      midBreakSegmentStartedAt: data.midBreakSegmentStartedAt ?? null,
      midBreakSegmentBaseSeconds: data.midBreakSegmentBaseSeconds ?? 0,
      exerciseSegmentStartedAt: data.exerciseSegmentStartedAt ?? null,
      exerciseSegmentBaseSeconds: data.exerciseSegmentBaseSeconds ?? 0,
      studySegmentStartedAt: data.studySegmentStartedAt ?? null,
      studySegmentBaseSeconds: data.studySegmentBaseSeconds ?? 0,
      activePomodoroPeriod: data.activePomodoroPeriod ?? null,
      currentPomodoroRound: data.currentPomodoroRound ?? 0,
      laborSegmentStartedAt: data.laborSegmentStartedAt ?? null,
      laborSegmentBaseSeconds: data.laborSegmentBaseSeconds ?? 0,
      laborCategory: data.laborCategory ?? null,
      laborResumeActivity: data.laborResumeActivity ?? null,
      laborResumeFreeHourRemaining: data.laborResumeFreeHourRemaining ?? null,
      laborResumeFreeHourPromptShown: data.laborResumeFreeHourPromptShown ?? false,
      laborResumeNightRestRemaining: data.laborResumeNightRestRemaining ?? null,
      laborResumePomodoroPhase: data.laborResumePomodoroPhase ?? null,
      laborResumePomodoroRemaining: data.laborResumePomodoroRemaining ?? null,
      laborSeconds: data.laborSeconds ?? 0,
      studySeconds: data.studySeconds ?? 0,
      countdownEndingReminderKey: data.countdownEndingReminderKey ?? null,
    }
  } catch {
    return createDefaultState()
  }
}

export function saveScheduleState(state: ScheduleState) {
  localStorage.setItem(
    SCHEDULE_STORAGE_KEY,
    JSON.stringify({ ...state, date: getTodayKey() }),
  )
}

export function getCurrentHourMinute() {
  const now = new Date()
  return { hour: now.getHours(), minute: now.getMinutes() }
}

export function isAfterMorningStart() {
  const { hour, minute } = getCurrentHourMinute()
  return hour > 9 || (hour === 9 && minute >= 0)
}

/** 今日尚未到达的 9:00 时间戳；已过 9 点则返回 null */
export function getNextMorningStartTimestamp(now = Date.now()): number | null {
  const date = new Date(now)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0, 0)
  if (now >= target.getTime()) return null
  return target.getTime()
}

export function isForceRestTime() {
  const { hour } = getCurrentHourMinute()
  return hour >= 23
}

/** 今日尚未到达的 23:00 时间戳；已过 23 点则返回 null */
export function getNextForceRestTimestamp(now = Date.now()): number | null {
  const date = new Date(now)
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 0, 0, 0)
  if (now >= target.getTime()) return null
  return target.getTime()
}

/** 休整日按当前时刻归入番茄统计时段（全天可用，仅用于轮数分桶） */
export function resolvePauseDayPeriodByClock(): DayPeriod {
  const { hour } = getCurrentHourMinute()
  if (hour >= 18) return 'evening'
  if (hour >= 14) return 'afternoon'
  return 'morning'
}

export function isPomodoroCountPeriod(period: DayPeriod) {
  return period === 'morning' || period === 'afternoon' || period === 'evening'
}

export function getPomodoroCountForPeriod(state: ScheduleState, period: DayPeriod) {
  switch (period) {
    case 'morning':
      return state.morningCount
    case 'afternoon':
      return state.afternoonCount
    case 'evening':
      return state.eveningCount
    default:
      return 0
  }
}

export function resolveActivePomodoroPeriod(state: ScheduleState): DayPeriod | null {
  if (state.activePomodoroPeriod && isPomodoroCountPeriod(state.activePomodoroPeriod)) {
    return state.activePomodoroPeriod
  }
  if (isPomodoroCountPeriod(state.dayPeriod)) return state.dayPeriod
  return null
}

export function isPomodoroRoundInProgress(state: ScheduleState) {
  return (
    state.activity === 'pomodoro' &&
    (state.pomodoroPhase === 'studying' ||
      state.pomodoroPhase === 'studyDone' ||
      state.pomodoroPhase === 'resting' ||
      state.pomodoroPhase === 'restDone')
  )
}

/** 某时段已结算进 storage 的番茄轮数 */
export function getPeriodPomodoroCount(state: ScheduleState) {
  const period = resolveActivePomodoroPeriod(state)
  if (!period) return 0
  return getPomodoroCountForPeriod(state, period)
}

export function getTotalPomodoroCount(state: ScheduleState) {
  return state.morningCount + state.afternoonCount + state.eveningCount
}

/** 界面展示：含当前进行中的轮次（无上限，与 MORNING_NOON_MIN 等门槛无关） */
export function getDisplayPomodoroCountForPeriod(state: ScheduleState, period: DayPeriod) {
  const completed = getPomodoroCountForPeriod(state, period)
  if (!isPomodoroRoundInProgress(state)) return completed
  if (resolveActivePomodoroPeriod(state) !== period) return completed
  return Math.max(completed, state.currentPomodoroRound)
}

export function getDisplayPeriodPomodoroCount(state: ScheduleState) {
  if (isPomodoroCountPeriod(state.dayPeriod)) {
    return getDisplayPomodoroCountForPeriod(state, state.dayPeriod)
  }
  if (state.activePomodoroPeriod && isPomodoroCountPeriod(state.activePomodoroPeriod)) {
    return getDisplayPomodoroCountForPeriod(state, state.activePomodoroPeriod)
  }
  return 0
}

export function getDisplayTotalPomodoroCount(state: ScheduleState) {
  let total = getTotalPomodoroCount(state)
  if (!isPomodoroRoundInProgress(state)) return total
  const activePeriod = resolveActivePomodoroPeriod(state)
  if (!activePeriod) return total
  const completed = getPomodoroCountForPeriod(state, activePeriod)
  if (state.currentPomodoroRound > completed) {
    total += state.currentPomodoroRound - completed
  }
  return total
}

export function incrementPeriodPomodoro(state: ScheduleState, period: DayPeriod, count = 1) {
  if (period === 'morning') state.morningCount += count
  else if (period === 'afternoon') state.afternoonCount += count
  else if (period === 'evening') state.eveningCount += count
}
