export const DAILY_CLEANLINESS_STORAGE_KEY = 'daily-cleanliness-record'

export interface DailyCleanlinessRecord {
  date: string
  maintained: boolean
}
