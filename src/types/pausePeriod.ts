export const PAUSE_PERIODS_STORAGE_KEY = 'pause-periods-v1'

export interface PausePeriod {
  id: string
  startDate: string
  endDate: string
  note?: string
  createdAt: number
}
