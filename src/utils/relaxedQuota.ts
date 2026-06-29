const RELAXED_WEEK_STORAGE_KEY = 'relaxed-pomodoro-week'
export const RELAXED_POMODORO_SECONDS = 2 * 60 * 60
export const RELAXED_WEEKLY_QUOTA = RELAXED_POMODORO_SECONDS

interface RelaxedWeekData {
  weekKey: string
  usedSeconds: number
}

export function getWeekKey() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.getFullYear(), now.getMonth(), diff)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const d = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function loadWeekData(): RelaxedWeekData {
  try {
    const raw = localStorage.getItem(RELAXED_WEEK_STORAGE_KEY)
    if (!raw) return { weekKey: getWeekKey(), usedSeconds: 0 }
    const data = JSON.parse(raw) as RelaxedWeekData
    if (data.weekKey !== getWeekKey()) return { weekKey: getWeekKey(), usedSeconds: 0 }
    return data
  } catch {
    return { weekKey: getWeekKey(), usedSeconds: 0 }
  }
}

function saveWeekData(data: RelaxedWeekData) {
  localStorage.setItem(RELAXED_WEEK_STORAGE_KEY, JSON.stringify(data))
}

export function getRelaxedWeekRemaining() {
  const data = loadWeekData()
  return Math.max(0, RELAXED_WEEKLY_QUOTA - data.usedSeconds)
}

export function canUseRelaxedPomodoro() {
  return getRelaxedWeekRemaining() >= RELAXED_POMODORO_SECONDS
}

export function consumeRelaxedQuota() {
  const data = loadWeekData()
  if (data.usedSeconds + RELAXED_POMODORO_SECONDS > RELAXED_WEEKLY_QUOTA) return false
  data.usedSeconds += RELAXED_POMODORO_SECONDS
  saveWeekData(data)
  return true
}
