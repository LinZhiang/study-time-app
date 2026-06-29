import type { DailyStarBreakdown, StaminaManualStars } from './dailyStars'
import type { ExerciseEntry } from './exercise'
import type { LaborCategory, LaborEntry } from './labor'
import type { Activity, DayPeriod, PomodoroPhase } from './schedule'

export type LogEventType =
  | 'mode_enter'
  | 'activity_start'
  | 'activity_end'
  | 'pomodoro_study_start'
  | 'pomodoro_study_end'
  | 'pomodoro_rest_start'
  | 'pomodoro_rest_end'
  | 'pomodoro_round_complete'
  | 'labor_record'
  | 'exercise_record'
  | 'stamina_adjust'
  | 'money_spend_submit'
  | 'cleanliness_mark'
  | 'study_record_change'

export interface LogEntry {
  id: string
  date: string
  time: string
  timestamp: number
  type: LogEventType
  period?: DayPeriod
  activity?: Activity
  pomodoroPhase?: PomodoroPhase
  pomodoroRound?: number
  label: string
  durationSeconds?: number
  calories?: number
  laborCategory?: LaborCategory
  manualStars?: StaminaManualStars
  moneySpent?: number
  moneyHasSpending?: boolean
  cleanlinessMaintained?: boolean
}

export interface DayLogScheduleSnapshot {
  morningPomodoros: number
  afternoonPomodoros: number
  eveningPomodoros: number
  studySeconds: number
  midBreakUsedSeconds: number
}

export interface DayLogSnapshot {
  finalizedAt: number
  paused?: boolean
  schedule: DayLogScheduleSnapshot
  stars?: DailyStarBreakdown
  laborEntries: LaborEntry[]
  exerciseEntries: ExerciseEntry[]
  laborSeconds: number
  exerciseSeconds: number
  exerciseCalories: number
}

export interface DayLogSummary {
  totalPomodoros: number
  morningPomodoros: number
  afternoonPomodoros: number
  eveningPomodoros: number
  studySeconds: number
  laborSeconds: number
  exerciseSeconds: number
  exerciseCalories: number
  totalStars?: number
  firstEventTime?: string
  lastEventTime?: string
}

export interface DayLog {
  date: string
  entries: LogEntry[]
  summary: DayLogSummary
  snapshot?: DayLogSnapshot
}

export const ACTIVITY_LOG_STORAGE_KEY = 'activity-logs'
export const LOGGING_START_DATE_KEY = 'activity-log-start-date'
