import type { DailyStarBreakdown, StaminaManualStars } from '../types/dailyStars'
import type { DailyExerciseRecord } from '../types/exercise'
import { DAILY_EXERCISE_STORAGE_KEY } from '../types/exercise'
import type { DailyLaborRecord, LaborEntry } from '../types/labor'
import { LABOR_CATEGORY_LABELS } from '../types/labor'
import { DAILY_LABOR_STORAGE_KEY } from '../types/labor'
import type { Activity, DayPeriod, ScheduleState } from '../types/schedule'
import { PERIOD_LABELS, SCHEDULE_STORAGE_KEY } from '../types/schedule'
import type { DayLog, DayLogSnapshot, LogEntry, LogEventType } from '../types/log'
import {
  ACTIVITY_LOG_STORAGE_KEY,
  LOGGING_START_DATE_KEY,
} from '../types/log'
import { getTodayKey } from './scheduleStorage'
import { shouldTrackStatistics } from './pausePeriod'

const ACTIVITY_LABELS: Partial<Record<Activity, string>> = {
  pomodoro: '番茄学习',
  waiting_meal: '等待用餐',
  free_hour: '自由 1 小时',
  free_hour_prompt: '自由休息（可提前学习）',
  exercise: '锻炼',
  mid_break: '中途休整',
  relaxed_pomodoro: '宽松番茄',
  night_rest_timer: '休息 30 分钟',
  sleep_prompt: '准备睡眠',
  before_morning: '等待早上开始',
  labor: '劳动',
}

function formatDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTimeNow(date = new Date()) {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function formatEntryClock(timestamp: number) {
  const date = new Date(timestamp)
  return formatTimeNow(date)
}

export function getLoggingStartDate(): string {
  const stored = localStorage.getItem(LOGGING_START_DATE_KEY)
  if (stored) return stored

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const startDate = formatDateKey(tomorrow)
  localStorage.setItem(LOGGING_START_DATE_KEY, startDate)
  return startDate
}

export function shouldLogToday(): boolean {
  return getTodayKey() >= getLoggingStartDate() && shouldTrackStatistics()
}

export function getLoggingStartDateLabel() {
  return getLoggingStartDate()
}

function createEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createEmptySummary(): DayLog['summary'] {
  return {
    totalPomodoros: 0,
    morningPomodoros: 0,
    afternoonPomodoros: 0,
    eveningPomodoros: 0,
    studySeconds: 0,
    laborSeconds: 0,
    exerciseSeconds: 0,
    exerciseCalories: 0,
  }
}

function readStoredLabor(): DailyLaborRecord | null {
  try {
    const raw = localStorage.getItem(DAILY_LABOR_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DailyLaborRecord
  } catch {
    return null
  }
}

function readStoredExercise(): DailyExerciseRecord | null {
  try {
    const raw = localStorage.getItem(DAILY_EXERCISE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DailyExerciseRecord
  } catch {
    return null
  }
}

function readStoredSchedule(): ScheduleState | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScheduleState
  } catch {
    return null
  }
}

function loadAllDayLogs(): DayLog[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as DayLog[]).map(normalizeDayLog)
  } catch {
    return []
  }
}

function saveAllDayLogs(logs: DayLog[]) {
  localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(logs))
}

function normalizeDayLog(dayLog: DayLog): DayLog {
  return {
    date: dayLog.date,
    entries: Array.isArray(dayLog.entries) ? dayLog.entries : [],
    summary: {
      ...createEmptySummary(),
      ...(dayLog.summary ?? {}),
    },
    snapshot: dayLog.snapshot,
  }
}

function updateSummaryFromEntry(summary: DayLog['summary'], entry: LogEntry) {
  summary.lastEventTime = entry.time
  if (!summary.firstEventTime) summary.firstEventTime = entry.time

  if (entry.type === 'pomodoro_round_complete') {
    summary.totalPomodoros += 1
    if (entry.period === 'morning') summary.morningPomodoros += 1
    if (entry.period === 'afternoon') summary.afternoonPomodoros += 1
    if (entry.period === 'evening') summary.eveningPomodoros += 1
  }
}

function syncLiveSummaryFromStorage(dayLog: DayLog) {
  if (dayLog.snapshot) {
    applySnapshotToSummary(dayLog.summary, dayLog.snapshot)
    return
  }

  if (dayLog.date !== getTodayKey()) return

  const schedule = readStoredSchedule()
  if (schedule?.date === dayLog.date) {
    dayLog.summary.morningPomodoros = schedule.morningCount ?? 0
    dayLog.summary.afternoonPomodoros = schedule.afternoonCount ?? 0
    dayLog.summary.eveningPomodoros = schedule.eveningCount ?? 0
    dayLog.summary.totalPomodoros =
      dayLog.summary.morningPomodoros +
      dayLog.summary.afternoonPomodoros +
      dayLog.summary.eveningPomodoros
    dayLog.summary.studySeconds = schedule.studySeconds ?? 0
  }

  const labor = readStoredLabor()
  if (labor?.date === dayLog.date) {
    dayLog.summary.laborSeconds = labor.totalSeconds ?? 0
  }

  const exercise = readStoredExercise()
  if (exercise?.date === dayLog.date) {
    dayLog.summary.exerciseSeconds = exercise.totalSeconds ?? 0
    dayLog.summary.exerciseCalories = exercise.totalCalories ?? 0
  }
}

function applySnapshotToSummary(summary: DayLog['summary'], snapshot: DayLogSnapshot) {
  summary.morningPomodoros = snapshot.schedule.morningPomodoros
  summary.afternoonPomodoros = snapshot.schedule.afternoonPomodoros
  summary.eveningPomodoros = snapshot.schedule.eveningPomodoros
  summary.totalPomodoros =
    snapshot.schedule.morningPomodoros +
    snapshot.schedule.afternoonPomodoros +
    snapshot.schedule.eveningPomodoros
  summary.studySeconds = snapshot.schedule.studySeconds
  summary.laborSeconds = snapshot.laborSeconds
  summary.exerciseSeconds = snapshot.exerciseSeconds
  summary.exerciseCalories = snapshot.exerciseCalories
  summary.totalStars = snapshot.stars?.totalStars
}

function buildScheduleSnapshot(date: string): DayLogSnapshot['schedule'] {
  const schedule = readStoredSchedule()
  if (schedule?.date === date) {
    return {
      morningPomodoros: schedule.morningCount ?? 0,
      afternoonPomodoros: schedule.afternoonCount ?? 0,
      eveningPomodoros: schedule.eveningCount ?? 0,
      studySeconds: schedule.studySeconds ?? 0,
      midBreakUsedSeconds: schedule.midBreakUsedSeconds ?? 0,
    }
  }
  return {
    morningPomodoros: 0,
    afternoonPomodoros: 0,
    eveningPomodoros: 0,
    studySeconds: 0,
    midBreakUsedSeconds: 0,
  }
}

function getOrCreateDayLog(logs: DayLog[], date: string) {
  let dayLog = logs.find((item) => item.date === date)
  if (!dayLog) {
    dayLog = { date, entries: [], summary: createEmptySummary() }
    logs.push(dayLog)
  }
  return dayLog
}

export function appendActivityLog(input: {
  type: LogEventType
  label: string
  period?: DayPeriod
  activity?: Activity
  pomodoroRound?: number
  durationSeconds?: number
  calories?: number
  laborCategory?: LaborEntry['category']
  manualStars?: StaminaManualStars
  moneySpent?: number
  moneyHasSpending?: boolean
  cleanlinessMaintained?: boolean
  at?: Date
}) {
  if (!shouldLogToday()) return

  const at = input.at ?? new Date()
  if (!shouldTrackStatistics(formatDateKey(at))) return
  const date = formatDateKey(at)
  const entry: LogEntry = {
    id: createEntryId(),
    date,
    time: formatTimeNow(at),
    timestamp: at.getTime(),
    type: input.type,
    period: input.period,
    activity: input.activity,
    pomodoroRound: input.pomodoroRound,
    label: input.label,
    durationSeconds: input.durationSeconds,
    calories: input.calories,
    laborCategory: input.laborCategory,
    manualStars: input.manualStars,
    moneySpent: input.moneySpent,
    moneyHasSpending: input.moneyHasSpending,
    cleanlinessMaintained: input.cleanlinessMaintained,
  }

  const logs = loadAllDayLogs()
  const dayLog = getOrCreateDayLog(logs, date)

  dayLog.entries.push(entry)
  updateSummaryFromEntry(dayLog.summary, entry)
  syncLiveSummaryFromStorage(dayLog)
  logs.sort((a, b) => b.date.localeCompare(a.date))
  saveAllDayLogs(logs)
}

export function logLaborRecord(entry: LaborEntry) {
  appendActivityLog({
    type: 'labor_record',
    period: entry.period,
    activity: 'labor',
    laborCategory: entry.category,
    durationSeconds: entry.durationSeconds,
    label: `${PERIOD_LABELS[entry.period]} · ${LABOR_CATEGORY_LABELS[entry.category]} ${formatDuration(entry.durationSeconds)}`,
    at: new Date(entry.endedAt),
  })
}

export function logExerciseRecord(entry: {
  durationSeconds: number
  calories: number
  period: DayPeriod
  endedAt: number
}) {
  appendActivityLog({
    type: 'exercise_record',
    period: entry.period,
    activity: 'exercise',
    durationSeconds: entry.durationSeconds,
    calories: entry.calories,
    label: `${PERIOD_LABELS[entry.period]} · 锻炼 ${formatDuration(entry.durationSeconds)} · ${Math.round(entry.calories)} 千卡`,
    at: new Date(entry.endedAt),
  })
}

export function logStaminaAdjust(manualStars: StaminaManualStars) {
  const label =
    manualStars === 1
      ? '体力手动 +1 星（休息良好）'
      : manualStars === -1
        ? '体力手动 −1 星（昨晚熬夜）'
        : '体力手动调整归零'
  appendActivityLog({
    type: 'stamina_adjust',
    manualStars,
    label,
  })
}

export function logMoneySpendSubmit(hasSpending: boolean, spent: number, totalSpent?: number) {
  const total = totalSpent ?? spent
  appendActivityLog({
    type: 'money_spend_submit',
    moneyHasSpending: hasSpending,
    moneySpent: spent,
    label: hasSpending
      ? `提交消费 ${Math.round(spent)} 元（今日累计 ${Math.round(total)} 元）`
      : '确认今日无消费',
  })
}

export function logCleanlinessMark(maintained: boolean) {
  appendActivityLog({
    type: 'cleanliness_mark',
    cleanlinessMaintained: maintained,
    label: maintained ? '标记今日已完成清洁卫生打理' : '取消今日清洁卫生打理标记',
  })
}

export type StudyRecordChangeAction =
  | 'major_add'
  | 'major_rename'
  | 'major_delete'
  | 'sub_add'
  | 'sub_rename'
  | 'sub_delete'
  | 'stars_change'

function buildStudyRecordChangeLabel(input: {
  action: StudyRecordChangeAction
  majorName: string
  subName?: string
  starsBefore?: number
  starsAfter?: number
  nameBefore?: string
  nameAfter?: string
}) {
  const prefix = '学习记录'
  switch (input.action) {
    case 'major_add':
      return `${prefix} · 新增大类「${input.majorName}」`
    case 'major_rename':
      return `${prefix} · 大类「${input.nameBefore}」改名为「${input.nameAfter}」`
    case 'major_delete':
      return `${prefix} · 删除大类「${input.majorName}」`
    case 'sub_add':
      return `${prefix} · ${input.majorName} · 新增小类「${input.subName}」`
    case 'sub_rename':
      return `${prefix} · ${input.majorName} · 「${input.nameBefore}」改名为「${input.nameAfter}」`
    case 'sub_delete':
      return `${prefix} · ${input.majorName} · 删除小类「${input.subName}」`
    case 'stars_change':
      return `${prefix} · ${input.majorName} · ${input.subName} ${input.starsBefore} 星 → ${input.starsAfter} 星`
  }
}

export function logStudyRecordChange(input: {
  action: StudyRecordChangeAction
  majorName: string
  subName?: string
  starsBefore?: number
  starsAfter?: number
  nameBefore?: string
  nameAfter?: string
}) {
  appendActivityLog({
    type: 'study_record_change',
    label: buildStudyRecordChangeLabel(input),
  })
}

export function finalizePausedDayLog(date: string) {
  const logs = loadAllDayLogs()
  const dayLog = getOrCreateDayLog(logs, date)
  dayLog.entries = []
  dayLog.summary = createEmptySummary()
  dayLog.snapshot = {
    finalizedAt: Date.now(),
    paused: true,
    schedule: {
      morningPomodoros: 0,
      afternoonPomodoros: 0,
      eveningPomodoros: 0,
      studySeconds: 0,
      midBreakUsedSeconds: 0,
    },
    laborEntries: [],
    exerciseEntries: [],
    laborSeconds: 0,
    exerciseSeconds: 0,
    exerciseCalories: 0,
  }
  logs.sort((a, b) => b.date.localeCompare(a.date))
  saveAllDayLogs(logs)
}

export function finalizeDayLog(date: string, starsBreakdown?: DailyStarBreakdown) {
  const logs = loadAllDayLogs()
  const dayLog = getOrCreateDayLog(logs, date)

  const labor = readStoredLabor()
  const exercise = readStoredExercise()
  const laborEntries = labor?.date === date ? [...(labor.entries ?? [])] : []
  const exerciseEntries = exercise?.date === date ? [...(exercise.entries ?? [])] : []

  const schedule = buildScheduleSnapshot(date)
  if (readStoredSchedule()?.date !== date) {
    schedule.morningPomodoros = dayLog.summary.morningPomodoros
    schedule.afternoonPomodoros = dayLog.summary.afternoonPomodoros
    schedule.eveningPomodoros = dayLog.summary.eveningPomodoros
    schedule.studySeconds = dayLog.summary.studySeconds
  }
  if (starsBreakdown) {
    schedule.studySeconds = starsBreakdown.studySeconds
  }

  const snapshot: DayLogSnapshot = {
    finalizedAt: Date.now(),
    schedule,
    stars: starsBreakdown,
    laborEntries,
    exerciseEntries,
    laborSeconds: labor?.date === date ? (labor.totalSeconds ?? 0) : 0,
    exerciseSeconds: exercise?.date === date ? (exercise.totalSeconds ?? 0) : 0,
    exerciseCalories: exercise?.date === date ? (exercise.totalCalories ?? 0) : 0,
  }

  dayLog.snapshot = snapshot
  applySnapshotToSummary(dayLog.summary, snapshot)
  logs.sort((a, b) => b.date.localeCompare(a.date))
  saveAllDayLogs(logs)
}

export function isDayLogFinalized(date: string): boolean {
  const dayLog = loadAllDayLogs().find((item) => item.date === date)
  return !!dayLog?.snapshot?.finalizedAt
}

export function loadActivityLogs(): DayLog[] {
  const logs = loadAllDayLogs().sort((a, b) => b.date.localeCompare(a.date))
  for (const dayLog of logs) {
    syncLiveSummaryFromStorage(dayLog)
  }
  return logs
}

export function getDayLogDisplaySnapshot(dayLog: DayLog): DayLogSnapshot {
  if (dayLog.snapshot) return dayLog.snapshot

  const schedule = buildScheduleSnapshot(dayLog.date)
  const labor = readStoredLabor()
  const exercise = readStoredExercise()

  return {
    finalizedAt: 0,
    schedule: {
      ...schedule,
      morningPomodoros: dayLog.summary.morningPomodoros,
      afternoonPomodoros: dayLog.summary.afternoonPomodoros,
      eveningPomodoros: dayLog.summary.eveningPomodoros,
      studySeconds: dayLog.summary.studySeconds,
    },
    laborEntries: labor?.date === dayLog.date ? labor.entries : [],
    exerciseEntries: exercise?.date === dayLog.date ? exercise.entries : [],
    laborSeconds: dayLog.summary.laborSeconds,
    exerciseSeconds: dayLog.summary.exerciseSeconds,
    exerciseCalories: dayLog.summary.exerciseCalories,
  }
}

export function formatLogDate(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `${y}年${m}月${d}日 周${weekday}`
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}小时${m}分`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

export function formatEntryTimeRange(startedAt: number, endedAt: number) {
  return `${formatEntryClock(startedAt)} - ${formatEntryClock(endedAt)}`
}

export function buildModeEnterLabel(period: DayPeriod) {
  return `进入${PERIOD_LABELS[period]}`
}

export function buildActivityStartLabel(activity: Activity, period?: DayPeriod) {
  const prefix = period ? `${PERIOD_LABELS[period]} · ` : ''
  return `${prefix}开始${ACTIVITY_LABELS[activity] ?? activity}`
}

export function buildActivityEndLabel(activity: Activity, period?: DayPeriod) {
  const prefix = period ? `${PERIOD_LABELS[period]} · ` : ''
  return `${prefix}结束${ACTIVITY_LABELS[activity] ?? activity}`
}

export function buildPomodoroRoundLabel(period: DayPeriod, round: number) {
  return `${PERIOD_LABELS[period]} · 第 ${round} 轮番茄完成`
}

export function buildPomodoroStudyStartLabel(period: DayPeriod, round: number) {
  return `${PERIOD_LABELS[period]} · 第 ${round} 轮开始上课`
}

export function buildPomodoroStudyEndLabel(period: DayPeriod, round: number) {
  return `${PERIOD_LABELS[period]} · 第 ${round} 轮学习结束（可下课）`
}

export function buildPomodoroRestStartLabel(period: DayPeriod, round: number) {
  return `${PERIOD_LABELS[period]} · 第 ${round} 轮开始休息`
}

export function buildPomodoroRestEndLabel(period: DayPeriod, round: number) {
  return `${PERIOD_LABELS[period]} · 第 ${round} 轮休息结束（该上课）`
}

export function buildLaborStartLabel(period: DayPeriod, category: LaborEntry['category']) {
  return `${PERIOD_LABELS[period]} · 开始${LABOR_CATEGORY_LABELS[category]}`
}
