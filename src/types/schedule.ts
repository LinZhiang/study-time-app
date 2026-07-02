import type { LaborCategory } from './labor'

export type DayPeriod = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night_rest' | 'sleep'

export type Activity =
  | 'pomodoro'
  | 'waiting_meal'
  | 'free_hour'
  | 'free_hour_prompt'
  | 'exercise'
  | 'labor'
  | 'mid_break'
  | 'relaxed_pomodoro'
  | 'night_rest_timer'
  | 'sleep_prompt'
  | 'before_morning'

export type PomodoroPhase = 'idle' | 'studying' | 'studyDone' | 'resting' | 'restDone'

export interface ScheduleState {
  date: string
  dayPeriod: DayPeriod
  activity: Activity
  morningCount: number
  afternoonCount: number
  eveningCount: number
  exerciseSeconds: number
  laborSeconds: number
  studySeconds: number
  freeHourRemaining: number | null
  freeHourPromptShown: boolean
  nightRestRemaining: number | null
  morningActivated: boolean
  /** 当前番茄循环所属时段（早/下/晚），与 dayPeriod 解耦，避免计数错位 */
  activePomodoroPeriod: DayPeriod | null
  /** 正在进行中的番茄轮次（界面展示会包含本轮；结算写入 morningCount 等在 enterRest 时） */
  currentPomodoroRound: number
  pomodoroPhase: PomodoroPhase
  pomodoroRemaining: number
  pausedStudyRemaining: number
  midBreakUsedSeconds: number
  relaxedPomodoroRemaining: number | null
  timerDeadlineAt: number | null
  midBreakSegmentStartedAt: number | null
  midBreakSegmentBaseSeconds: number
  exerciseSegmentStartedAt: number | null
  exerciseSegmentBaseSeconds: number
  studySegmentStartedAt: number | null
  studySegmentBaseSeconds: number
  laborSegmentStartedAt: number | null
  laborSegmentBaseSeconds: number
  laborCategory: LaborCategory | null
  laborResumeActivity: Activity | null
  laborResumeFreeHourRemaining: number | null
  laborResumeFreeHourPromptShown: boolean
  laborResumeNightRestRemaining: number | null
  /** 当前倒计时段是否已播放「快结束」提醒（键含 deadline/段起点，防重复） */
  countdownEndingReminderKey: string | null
}

export const SCHEDULE_STORAGE_KEY = 'day-schedule-state'

export const PERIOD_LABELS: Record<DayPeriod, string> = {
  morning: '早上模式',
  noon: '中午模式',
  afternoon: '下午模式',
  evening: '晚上模式',
  night_rest: '休息模式',
  sleep: '睡眠模式',
}
