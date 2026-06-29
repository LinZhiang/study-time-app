/** 劳动：累计超过 30 / 90 分钟各得 1 星（最多 2 星） */
export const LABOR_STAR_THRESHOLDS_SECONDS = [30 * 60, 90 * 60] as const

/** 锻炼：大卡 ≥100 得 1 星，≥180 得 2 星；低于 100 扣 1 星 */
export const EXERCISE_STAR_THRESHOLDS = {
  oneStar: 100,
  twoStars: 180,
} as const

/** 毅力：运动 ≥30 分钟且学习 ≥6 小时 +1 星，否则 −1 星 */
export const PERSEVERANCE_THRESHOLDS = {
  exerciseSeconds: 30 * 60,
  studySeconds: 6 * 60 * 60,
} as const

/** 星级统计起始日（不含 6 月 29 日） */
export const DAILY_STARS_START_DATE = '2026-06-30'

export const DAILY_STARS_ARCHIVE_KEY = 'daily-stars-archive'
export const DAILY_STAMINA_STORAGE_KEY = 'daily-stamina-adjustment'

export type StaminaManualStars = -1 | 0 | 1

/** 体力：运动大卡 ≥100 自动 +1 星，可手动 ±1 星（如昨晚是否熬夜） */
export const STAMINA_CALORIE_THRESHOLD = EXERCISE_STAR_THRESHOLDS.oneStar

export interface DailyStarBreakdown {
  laborStars: number
  exerciseStars: number
  perseveranceStars: number
  staminaStars: number
  staminaAutoStars: number
  staminaManualStars: StaminaManualStars
  totalStars: number
  laborSeconds: number
  exerciseCalories: number
  exerciseDurationSeconds: number
  studySeconds: number
  moneyWalletBalance: number
  moneyDailyIncrement: number
  moneySpent: number
  moneyHasSpending: boolean
  moneySubmitted: boolean
  cleanlinessStars: number
  cleanlinessMaintained: boolean
}

export interface DailyStarsArchiveEntry {
  date: string
  breakdown: DailyStarBreakdown
}

export type DailyStarsDisplayState =
  | { status: 'before_start'; startDate: string }
  | { status: 'waiting_day_end'; todayKey: string }
  | { status: 'paused_today'; todayKey: string }
  | { status: 'paused_yesterday'; date: string }
  | { status: 'ready'; date: string; breakdown: DailyStarBreakdown }
