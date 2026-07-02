import type { DailyStarBreakdown, StaminaManualStars } from '../types/dailyStars'
import {
  EXECUTION_POMODORO_THRESHOLDS,
  EXERCISE_STAR_THRESHOLDS,
  LABOR_METRIC_THRESHOLD_SECONDS,
  LABOR_STAR_THRESHOLDS_SECONDS,
  PERSEVERANCE_THRESHOLDS,
} from '../types/dailyStars'
import { loadTodayExerciseRecord } from './exerciseRecord'
import { loadTodayLaborRecord, formatLaborDuration } from './laborRecord'
import type { MoneySpendSnapshot } from '../types/moneySpend'
import { MONEY_DAILY_INCREMENT } from '../types/moneySpend'
import { loadScheduleState } from './scheduleStorage'

export function calculateLaborStars(laborSeconds: number): number {
  let stars = 0
  if (laborSeconds > LABOR_STAR_THRESHOLDS_SECONDS[0]) stars = 1
  if (laborSeconds > LABOR_STAR_THRESHOLDS_SECONDS[1]) stars = 2
  return stars
}

/** 劳动力指标：超过 30 分钟 +1，否则 −1 */
export function calculateLaborMetricStars(laborSeconds: number): number {
  return laborSeconds > LABOR_METRIC_THRESHOLD_SECONDS ? 1 : -1
}

export function describeLaborMetricMeta(laborSeconds: number): string {
  return `累计 ${formatLaborDuration(laborSeconds)}`
}

export function calculateExerciseStars(exerciseCalories: number): number {
  if (exerciseCalories >= EXERCISE_STAR_THRESHOLDS.twoStars) return 2
  if (exerciseCalories >= EXERCISE_STAR_THRESHOLDS.oneStar) return 1
  return -1
}

export function calculatePerseveranceStars(exerciseSeconds: number, studySeconds: number): number {
  const exerciseMet = exerciseSeconds >= PERSEVERANCE_THRESHOLDS.exerciseSeconds
  const studyMet = studySeconds >= PERSEVERANCE_THRESHOLDS.studySeconds
  return exerciseMet && studyMet ? 1 : -1
}

/** 体力自动计星：与锻炼大卡规则一致（≥180 +2，≥100 +1，<100 −1） */
export function calculateStaminaAutoStars(exerciseCalories: number): number {
  return calculateExerciseStars(exerciseCalories)
}

export function describeStaminaAutoStars(autoStars: number, prefix = '自动'): string {
  if (autoStars === 2) return `${prefix} +2`
  if (autoStars === 1) return `${prefix} +1`
  if (autoStars === -1) return `${prefix} −1`
  return ''
}

export function calculateStaminaStars(
  exerciseCalories: number,
  manualStars: StaminaManualStars,
): number {
  return calculateStaminaAutoStars(exerciseCalories) + manualStars
}

export function calculateCleanlinessStars(maintained: boolean): number {
  return maintained ? 1 : 0
}

export function calculateExecutionStars(counts: {
  morningCount: number
  afternoonCount: number
  eveningCount: number
}): number {
  if (
    counts.morningCount >= EXECUTION_POMODORO_THRESHOLDS.morning &&
    counts.afternoonCount >= EXECUTION_POMODORO_THRESHOLDS.afternoon &&
    counts.eveningCount >= EXECUTION_POMODORO_THRESHOLDS.evening
  ) {
    return 1
  }
  return 0
}

export function describeExecutionPomodoroMeta(counts: {
  morningCount: number
  afternoonCount: number
  eveningCount: number
}): string {
  return [
    `早 ${counts.morningCount}/${EXECUTION_POMODORO_THRESHOLDS.morning}`,
    `下 ${counts.afternoonCount}/${EXECUTION_POMODORO_THRESHOLDS.afternoon}`,
    `晚 ${counts.eveningCount}/${EXECUTION_POMODORO_THRESHOLDS.evening}`,
  ].join(' · ')
}

export function loadTodayLaborDurationSeconds(): number {
  const record = loadTodayLaborRecord()
  const state = loadScheduleState()
  if (state.activity === 'labor' && state.laborSegmentStartedAt) {
    const elapsed = Math.floor((Date.now() - state.laborSegmentStartedAt) / 1000)
    return Math.max(record.totalSeconds, state.laborSegmentBaseSeconds + elapsed)
  }
  return Math.max(record.totalSeconds, state.laborSeconds ?? 0)
}

export function loadTodayExerciseDurationSeconds(): number {
  const record = loadTodayExerciseRecord()
  const state = loadScheduleState()
  if (state.activity === 'exercise' && state.exerciseSegmentStartedAt) {
    const elapsed = Math.floor((Date.now() - state.exerciseSegmentStartedAt) / 1000)
    return Math.max(record.totalSeconds, state.exerciseSegmentBaseSeconds + elapsed)
  }
  return Math.max(record.totalSeconds, state.exerciseSeconds ?? 0)
}

export function loadTodayStudySeconds(): number {
  const state = loadScheduleState()
  if (
    state.activity === 'pomodoro' &&
    state.pomodoroPhase === 'studying' &&
    state.studySegmentStartedAt
  ) {
    const elapsed = Math.floor((Date.now() - state.studySegmentStartedAt) / 1000)
    return state.studySegmentBaseSeconds + elapsed
  }
  return state.studySeconds ?? 0
}

export function calculateDailyStars(input: {
  laborSeconds: number
  exerciseCalories: number
  exerciseDurationSeconds: number
  studySeconds: number
  morningCount?: number
  afternoonCount?: number
  eveningCount?: number
  manualStaminaStars?: StaminaManualStars
  cleanlinessMaintained?: boolean
  money?: MoneySpendSnapshot
}): DailyStarBreakdown {
  const laborStars = calculateLaborStars(input.laborSeconds)
  const laborMetricStars = calculateLaborMetricStars(input.laborSeconds)
  const exerciseStars = calculateExerciseStars(input.exerciseCalories)
  const perseveranceStars = calculatePerseveranceStars(
    input.exerciseDurationSeconds,
    input.studySeconds,
  )
  const morningPomodoroCount = input.morningCount ?? 0
  const afternoonPomodoroCount = input.afternoonCount ?? 0
  const eveningPomodoroCount = input.eveningCount ?? 0
  const executionStars = calculateExecutionStars({
    morningCount: morningPomodoroCount,
    afternoonCount: afternoonPomodoroCount,
    eveningCount: eveningPomodoroCount,
  })
  const manualStaminaStars = input.manualStaminaStars ?? 0
  const staminaAutoStars = calculateStaminaAutoStars(input.exerciseCalories)
  const staminaStars = staminaAutoStars + manualStaminaStars
  const cleanlinessMaintained = !!input.cleanlinessMaintained
  const cleanlinessStars = calculateCleanlinessStars(cleanlinessMaintained)
  const money = input.money ?? {
    walletBalance: 0,
    dailyIncrement: MONEY_DAILY_INCREMENT,
    hasSpending: false,
    spent: 0,
    submitted: false,
  }

  return {
    laborStars,
    laborMetricStars,
    exerciseStars,
    perseveranceStars,
    executionStars,
    staminaStars,
    staminaAutoStars,
    staminaManualStars: manualStaminaStars,
    totalStars:
      laborStars +
      laborMetricStars +
      exerciseStars +
      perseveranceStars +
      executionStars +
      staminaStars +
      cleanlinessStars,
    laborSeconds: input.laborSeconds,
    exerciseCalories: input.exerciseCalories,
    exerciseDurationSeconds: input.exerciseDurationSeconds,
    studySeconds: input.studySeconds,
    morningPomodoroCount,
    afternoonPomodoroCount,
    eveningPomodoroCount,
    moneyWalletBalance: money.walletBalance,
    moneyDailyIncrement: money.dailyIncrement,
    moneySpent: money.spent,
    moneyHasSpending: money.hasSpending,
    moneySubmitted: money.submitted,
    cleanlinessStars,
    cleanlinessMaintained,
  }
}

export function loadTodayDailyStars(): DailyStarBreakdown {
  const exercise = loadTodayExerciseRecord()
  const schedule = loadScheduleState()
  const laborSeconds = loadTodayLaborDurationSeconds()
  return calculateDailyStars({
    laborSeconds,
    exerciseCalories: exercise.totalCalories,
    exerciseDurationSeconds: loadTodayExerciseDurationSeconds(),
    studySeconds: loadTodayStudySeconds(),
    morningCount: schedule.morningCount,
    afternoonCount: schedule.afternoonCount,
    eveningCount: schedule.eveningCount,
  })
}

/** @deprecated 日常星级页请使用 getDailyStarsDisplayState，当日进行中不展示 */
export function loadLiveTodayDailyStars(): DailyStarBreakdown {
  return loadTodayDailyStars()
}

/** 将星数渲染为 ★ / ☆ 字符串（负数用 − 前缀） */
export function formatStarCount(stars: number, maxPositive = 2): string {
  if (stars < 0) return `−${'★'.repeat(Math.abs(stars))}`
  const filled = '★'.repeat(stars)
  const empty = '☆'.repeat(Math.max(0, maxPositive - stars))
  return filled + empty
}

export const formatStudyDuration = formatLaborDuration
export const formatExerciseDurationForStars = formatLaborDuration
