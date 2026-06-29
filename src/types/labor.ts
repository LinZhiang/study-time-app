import type { DayPeriod } from './schedule'

export type LaborCategory = 'cooking' | 'cleaning' | 'exam_prep' | 'other'

export const LABOR_CATEGORY_LABELS: Record<LaborCategory, string> = {
  cooking: '做饭',
  cleaning: '清洁',
  exam_prep: '准备考试资料',
  other: '其他劳动',
}

export interface LaborEntry {
  id: string
  category: LaborCategory
  durationSeconds: number
  startedAt: number
  endedAt: number
  period: DayPeriod
}

export interface DailyLaborRecord {
  date: string
  totalSeconds: number
  entries: LaborEntry[]
}

export const DAILY_LABOR_STORAGE_KEY = 'daily-labor-record'
