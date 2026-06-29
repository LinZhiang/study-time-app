import type { DailyExerciseRecord, ExerciseEntry } from '../types/exercise'
import { DAILY_EXERCISE_STORAGE_KEY } from '../types/exercise'
import type { DayPeriod } from '../types/schedule'
import { getTodayKey } from './scheduleStorage'
import { formatLaborClock, formatLaborDuration } from './laborRecord'
import { logExerciseRecord } from './activityLog'

function createEmptyRecord(date = getTodayKey()): DailyExerciseRecord {
  return { date, totalSeconds: 0, totalCalories: 0, entries: [] }
}

function normalizeEntries(entries: ExerciseEntry[]): ExerciseEntry[] {
  return entries.map((entry) => ({
    ...entry,
    calories: typeof entry.calories === 'number' ? entry.calories : 0,
  }))
}

function loadRawRecord(): DailyExerciseRecord {
  try {
    const raw = localStorage.getItem(DAILY_EXERCISE_STORAGE_KEY)
    if (!raw) return createEmptyRecord()
    const data = JSON.parse(raw) as DailyExerciseRecord
    if (data.date !== getTodayKey()) return createEmptyRecord()
    const entries = normalizeEntries(Array.isArray(data.entries) ? data.entries : [])
    return {
      date: getTodayKey(),
      totalSeconds: data.totalSeconds ?? 0,
      totalCalories: data.totalCalories ?? entries.reduce((sum, entry) => sum + entry.calories, 0),
      entries,
    }
  } catch {
    return createEmptyRecord()
  }
}

function saveRecord(record: DailyExerciseRecord) {
  localStorage.setItem(DAILY_EXERCISE_STORAGE_KEY, JSON.stringify(record))
}

export function loadTodayExerciseRecord(): DailyExerciseRecord {
  return loadRawRecord()
}

export function appendExerciseEntry(input: {
  durationSeconds: number
  calories: number
  startedAt: number
  endedAt: number
  period: DayPeriod
}) {
  const record = loadRawRecord()
  const entry: ExerciseEntry = {
    id: `${input.endedAt}-${Math.random().toString(36).slice(2, 8)}`,
    durationSeconds: input.durationSeconds,
    calories: input.calories,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    period: input.period,
  }
  record.entries.unshift(entry)
  record.totalSeconds += input.durationSeconds
  record.totalCalories += input.calories
  saveRecord(record)
  logExerciseRecord({
    durationSeconds: input.durationSeconds,
    calories: input.calories,
    period: input.period,
    endedAt: input.endedAt,
  })
  return entry
}

export const formatExerciseDuration = formatLaborDuration
export const formatExerciseClock = formatLaborClock

export function formatExerciseCalories(calories: number) {
  return `${Math.round(calories)} 千卡`
}
