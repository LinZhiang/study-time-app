import type { DayPeriod } from './schedule'

export interface ExerciseEntry {
  id: string
  durationSeconds: number
  calories: number
  startedAt: number
  endedAt: number
  period: DayPeriod
}

export interface DailyExerciseRecord {
  date: string
  totalSeconds: number
  totalCalories: number
  entries: ExerciseEntry[]
}

export const DAILY_EXERCISE_STORAGE_KEY = 'daily-exercise-record'
