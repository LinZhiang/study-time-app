import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import type { LaborCategory } from '../types/labor'
import { LABOR_CATEGORY_LABELS } from '../types/labor'
import type { Activity, DayPeriod, PomodoroPhase } from '../types/schedule'
import { PERIOD_LABELS } from '../types/schedule'
import {
  audioUnlockedRef,
  playActivitySwitchSound,
  playModeSwitchSound,
  playPomodoroSound,
  playReminderSound,
  sounds,
  unlockAudio,
} from '../utils/audio'
import {
  appendActivityLog,
  buildActivityEndLabel,
  buildActivityStartLabel,
  buildModeEnterLabel,
  buildPomodoroRestEndLabel,
  buildPomodoroRestStartLabel,
  buildPomodoroRoundLabel,
  buildPomodoroStudyEndLabel,
  buildPomodoroStudyStartLabel,
  buildLaborStartLabel,
} from '../utils/activityLog'
import {
  canUseRelaxedPomodoro,
  consumeRelaxedQuota,
  getRelaxedWeekRemaining,
  RELAXED_POMODORO_SECONDS,
} from '../utils/relaxedQuota'
import { appendExerciseEntry } from '../utils/exerciseRecord'
import { appendLaborEntry } from '../utils/laborRecord'
import {
  AFTERNOON_EVENING_MIN,
  createDefaultState,
  EVENING_REST_MIN,
  formatTime,
  getPeriodPomodoroCount,
  getPomodoroCountForPeriod,
  getTodayKey,
  getTotalPomodoroCount,
  incrementPeriodPomodoro,
  isAfterMorningStart,
  isForceRestTime,
  isPomodoroCountPeriod,
  loadScheduleState,
  MORNING_NOON_MIN,
  saveScheduleState,
} from '../utils/scheduleStorage'

const STUDY_SECONDS = 40 * 60
const MID_BREAK_DAILY_QUOTA = 30 * 60
const REST_SECONDS = 9 * 60
const STUDY_DONE_GRACE_SECONDS = 10 * 60
const REST_DONE_GRACE_SECONDS = 3 * 60
const FREE_HOUR_SECONDS = 60 * 60
const FREE_HOUR_PROMPT_AT = 55 * 60
const NIGHT_REST_SECONDS = 30 * 60
const RING_CIRCUMFERENCE = 553
const POMODORO_STORAGE_KEY = 'pomodoro-daily-count'

function syncLegacyTodayCount(total: number) {
  localStorage.setItem(
    POMODORO_STORAGE_KEY,
    JSON.stringify({ date: getTodayKey(), count: total }),
  )
}

export const LABOR_CATEGORIES: LaborCategory[] = ['cooking', 'cleaning', 'exam_prep', 'other']

export function useTimeManagement() {
  const state = reactive(loadScheduleState())
  const showLaborPicker = ref(false)
  const showExerciseCalorieForm = ref(false)
  /** 今日番茄 = 各时段已完成轮数之和（单一数据源，无上限） */
  const todayCount = computed(() => getTotalPomodoroCount(state))
  /** 驱动界面每秒刷新（Date.now 本身不是响应式的） */
  const clockNow = ref(Date.now())
  let timerId: ReturnType<typeof setInterval> | null = null
  let tickId: ReturnType<typeof setInterval> | null = null
  let watchdogId: ReturnType<typeof setInterval> | null = null
  let countdownOnComplete: (() => void) | null = null

  function bumpClock() {
    clockNow.value = Date.now()
  }

  function isTimerActive() {
    if (state.timerDeadlineAt) return true
    if (state.activity === 'mid_break' && state.midBreakSegmentStartedAt) return true
    if (state.activity === 'exercise' && state.exerciseSegmentStartedAt) return true
    if (state.activity === 'labor' && state.laborSegmentStartedAt) return true
    return false
  }

  function getMidBreakUsedNow() {
    if (state.activity !== 'mid_break' || !state.midBreakSegmentStartedAt) {
      return state.midBreakUsedSeconds
    }
    const elapsed = Math.floor((Date.now() - state.midBreakSegmentStartedAt) / 1000)
    return Math.min(MID_BREAK_DAILY_QUOTA, state.midBreakSegmentBaseSeconds + elapsed)
  }

  function getExerciseSecondsNow() {
    if (state.activity !== 'exercise' || !state.exerciseSegmentStartedAt) {
      return state.exerciseSeconds
    }
    const elapsed = Math.floor((Date.now() - state.exerciseSegmentStartedAt) / 1000)
    return state.exerciseSegmentBaseSeconds + elapsed
  }

  function getLaborSecondsNow() {
    if (state.activity !== 'labor' || !state.laborSegmentStartedAt) {
      return state.laborSeconds
    }
    const elapsed = Math.floor((Date.now() - state.laborSegmentStartedAt) / 1000)
    return state.laborSegmentBaseSeconds + elapsed
  }

  function isStudyingNow() {
    return state.activity === 'pomodoro' && state.pomodoroPhase === 'studying'
  }

  function canStartLaborNow() {
    if (isForceRestTime()) return false
    return (
      state.activity === 'waiting_meal' ||
      state.activity === 'free_hour' ||
      state.activity === 'free_hour_prompt' ||
      state.activity === 'night_rest_timer'
    )
  }

  function isPomodoroPeriod(period: DayPeriod) {
    return isPomodoroCountPeriod(period)
  }

  function resolveRecordingPeriod() {
    if (state.activePomodoroPeriod && isPomodoroPeriod(state.activePomodoroPeriod)) {
      return state.activePomodoroPeriod
    }
    if (isPomodoroPeriod(state.dayPeriod)) return state.dayPeriod
    return null
  }

  function clearPomodoroSession() {
    pauseStudySegment()
    state.activePomodoroPeriod = null
    state.currentPomodoroRound = 0
  }

  function persist() {
    saveScheduleState({ ...state })
    syncLegacyTodayCount(getTotalPomodoroCount(state))
  }

  function logModeEnter(period: DayPeriod) {
    appendActivityLog({
      type: 'mode_enter',
      period,
      label: buildModeEnterLabel(period),
    })
  }

  function logActivityStart(activity: Activity, period: DayPeriod) {
    appendActivityLog({
      type: 'activity_start',
      period,
      activity,
      label: buildActivityStartLabel(activity, period),
    })
  }

  function logActivityEnd(activity: Activity, period: DayPeriod) {
    appendActivityLog({
      type: 'activity_end',
      period,
      activity,
      label: buildActivityEndLabel(activity, period),
    })
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId)
      timerId = null
    }
    countdownOnComplete = null
  }

  function clearCountdownDeadline() {
    state.timerDeadlineAt = null
  }

  function getCountdownRemaining() {
    if (!state.timerDeadlineAt) return getStoredRemainingSeconds()
    return Math.max(0, Math.ceil((state.timerDeadlineAt - Date.now()) / 1000))
  }

  function getStoredRemainingSeconds() {
    if (state.activity === 'free_hour' || state.activity === 'free_hour_prompt') {
      return state.freeHourRemaining ?? 0
    }
    if (state.activity === 'night_rest_timer' || state.activity === 'sleep_prompt') {
      return state.nightRestRemaining ?? 0
    }
    if (state.activity === 'relaxed_pomodoro') {
      return state.relaxedPomodoroRemaining ?? 0
    }
    return state.pomodoroRemaining
  }

  function syncStoredRemainingFromDeadline() {
    const remaining = getCountdownRemaining()
    if (state.activity === 'free_hour' || state.activity === 'free_hour_prompt') {
      state.freeHourRemaining = remaining
    } else if (state.activity === 'night_rest_timer' || state.activity === 'sleep_prompt') {
      state.nightRestRemaining = remaining
    } else if (state.activity === 'relaxed_pomodoro') {
      state.relaxedPomodoroRemaining = remaining
    } else {
      state.pomodoroRemaining = remaining
    }
  }

  function beginCountdown(seconds: number, onComplete: () => void) {
    stopTimer()
    countdownOnComplete = onComplete
    state.timerDeadlineAt = Date.now() + seconds * 1000
    syncStoredRemainingFromDeadline()
    persist()
    runTimerTick()
    if (!timerId) {
      timerId = setInterval(runTimerTick, 1000)
    }
  }

  function startCountdown(onComplete: () => void) {
    beginCountdown(getStoredRemainingSeconds(), onComplete)
  }

  function runTimerTick() {
    bumpClock()
    syncMidBreakFromClock()
    syncExerciseFromClock()
    syncLaborFromClock()

    if (state.timerDeadlineAt) {
      syncStoredRemainingFromDeadline()
      tickFreeHour()

      if (getCountdownRemaining() <= 0) {
        state.timerDeadlineAt = null
        const done = countdownOnComplete
        stopTimer()
        persist()
        done?.()
        return
      }
      persist()
    } else if (state.activity === 'mid_break' || state.activity === 'exercise' || state.activity === 'labor') {
      persist()
    }
  }

  function syncAllFromClock() {
    bumpClock()

    if (state.timerDeadlineAt && state.timerDeadlineAt <= Date.now()) {
      state.timerDeadlineAt = null
      const done = countdownOnComplete ?? resolveCountdownOnComplete()
      stopTimer()
      persist()
      done?.()
      return
    }

    if (state.timerDeadlineAt) {
      countdownOnComplete = countdownOnComplete ?? resolveCountdownOnComplete()
      syncStoredRemainingFromDeadline()
      tickFreeHour()
    }

    syncMidBreakFromClock()
    syncExerciseFromClock()
    syncLaborFromClock()
    syncStudyFromClock()
    persist()
  }

  function getRemainingSeconds() {
    void clockNow.value
    if (state.activity === 'mid_break') {
      return Math.max(0, MID_BREAK_DAILY_QUOTA - getMidBreakUsedNow())
    }
    if (state.timerDeadlineAt) return getCountdownRemaining()
    return getStoredRemainingSeconds()
  }

  function syncMidBreakFromClock() {
    if (state.activity !== 'mid_break' || !state.midBreakSegmentStartedAt) return
    const elapsed = Math.floor((Date.now() - state.midBreakSegmentStartedAt) / 1000)
    state.midBreakUsedSeconds = state.midBreakSegmentBaseSeconds + elapsed
    if (state.midBreakUsedSeconds >= MID_BREAK_DAILY_QUOTA) {
      state.midBreakUsedSeconds = MID_BREAK_DAILY_QUOTA
      endMidBreak(true)
    }
  }

  function syncExerciseFromClock() {
    if (state.activity !== 'exercise' || !state.exerciseSegmentStartedAt) return
    const elapsed = Math.floor((Date.now() - state.exerciseSegmentStartedAt) / 1000)
    state.exerciseSeconds = state.exerciseSegmentBaseSeconds + elapsed
  }

  function syncLaborFromClock() {
    if (state.activity !== 'labor' || !state.laborSegmentStartedAt) return
    const elapsed = Math.floor((Date.now() - state.laborSegmentStartedAt) / 1000)
    state.laborSeconds = state.laborSegmentBaseSeconds + elapsed
  }

  function syncStudyFromClock() {
    if (!isStudyingNow() || !state.studySegmentStartedAt) return
    const elapsed = Math.floor((Date.now() - state.studySegmentStartedAt) / 1000)
    state.studySeconds = state.studySegmentBaseSeconds + elapsed
  }

  function ensureStudySegment() {
    if (!isStudyingNow() || state.studySegmentStartedAt) return
    state.studySegmentBaseSeconds = state.studySeconds
    state.studySegmentStartedAt = Date.now()
  }

  function pauseStudySegment() {
    if (!state.studySegmentStartedAt) return
    syncStudyFromClock()
    state.studySegmentStartedAt = null
  }

  function handleAppVisible() {
    syncAllFromClock()
    if (isTimerActive()) {
      if (!countdownOnComplete && state.timerDeadlineAt) {
        countdownOnComplete = resolveCountdownOnComplete()
      }
      ensureTimerLoop()
    }
  }

  function handleAppHidden() {
    persist()
  }

  function startWatchdog() {
    if (watchdogId) return
    watchdogId = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (!isTimerActive()) return
      syncAllFromClock()
      if (!timerId) ensureTimerLoop()
    }, 2000)
  }

  function stopWatchdog() {
    if (watchdogId) {
      clearInterval(watchdogId)
      watchdogId = null
    }
  }

  function ensureTimerLoop() {
    if (!timerId) {
      timerId = setInterval(runTimerTick, 1000)
    }
  }

  function resolveCountdownOnComplete() {
    if (state.activity === 'free_hour' || state.activity === 'free_hour_prompt') {
      return onFreeHourFinished
    }
    if (state.activity === 'night_rest_timer') return onNightRestFinished
    if (state.activity === 'relaxed_pomodoro') return onRelaxedPomodoroFinished
    if (state.pomodoroPhase === 'studying') return onStudyFinished
    if (state.pomodoroPhase === 'resting') return onRestFinished
    if (state.pomodoroPhase === 'studyDone') return enterRest
    if (state.pomodoroPhase === 'restDone') return startStudy
    return null
  }

  function resumeTimersAfterLoad() {
    if (state.timerDeadlineAt && state.timerDeadlineAt <= Date.now()) {
      state.timerDeadlineAt = null
      const done = resolveCountdownOnComplete()
      if (done) {
        done()
        return
      }
    }

    if (state.timerDeadlineAt) {
      countdownOnComplete = resolveCountdownOnComplete() ?? null
      syncStoredRemainingFromDeadline()
      ensureTimerLoop()
    } else {
      const done = resolveCountdownOnComplete()
      const remaining = getStoredRemainingSeconds()
      if (done && remaining > 0) {
        startCountdown(done)
      }
    }

    if (state.activity === 'mid_break') {
      if (!state.midBreakSegmentStartedAt) {
        state.midBreakSegmentStartedAt = Date.now()
        state.midBreakSegmentBaseSeconds = state.midBreakUsedSeconds
      }
      ensureTimerLoop()
    }

    if (state.activity === 'exercise') {
      if (!state.exerciseSegmentStartedAt) {
        state.exerciseSegmentStartedAt = Date.now()
        state.exerciseSegmentBaseSeconds = state.exerciseSeconds
      }
      ensureTimerLoop()
    }

    if (state.activity === 'labor') {
      if (!state.laborSegmentStartedAt) {
        state.laborSegmentStartedAt = Date.now()
        state.laborSegmentBaseSeconds = state.laborSeconds
      }
      ensureTimerLoop()
    }

    if (isStudyingNow()) {
      ensureStudySegment()
    }
  }

  function tickFreeHour() {
    if (state.activity !== 'free_hour' && state.activity !== 'free_hour_prompt') return
    const elapsed = FREE_HOUR_SECONDS - (state.freeHourRemaining ?? 0)
    if (elapsed >= FREE_HOUR_PROMPT_AT && !state.freeHourPromptShown) {
      state.freeHourPromptShown = true
      state.activity = 'free_hour_prompt'
      playReminderSound()
      persist()
    }
  }

  function switchMode(period: DayPeriod, activity: Activity, options?: { playSound?: boolean }) {
    const prevPeriod = state.dayPeriod
    const prevActivity = state.activity

    if (prevActivity === 'pomodoro' && state.pomodoroPhase === 'studying') {
      pauseStudySegment()
    }

    if (options?.playSound !== false) playModeSwitchSound()
    state.dayPeriod = period
    state.activity = activity

    if (prevPeriod !== period) {
      logModeEnter(period)
    }
    if (
      prevActivity !== activity &&
      prevActivity !== 'before_morning' &&
      (prevActivity !== 'pomodoro' || activity !== 'pomodoro')
    ) {
      logActivityEnd(prevActivity, prevPeriod)
    }
    if (
      prevActivity !== activity &&
      activity !== 'pomodoro' &&
      activity !== 'before_morning'
    ) {
      logActivityStart(activity, period)
    }

    persist()
  }

  function activateMorningMode() {
    if (state.morningActivated) return
    state.morningActivated = true
    switchMode('morning', 'pomodoro')
    startStudy(true)
  }

  function checkMorningStart() {
    if (state.date !== getTodayKey()) {
      Object.assign(state, createDefaultState())
    }
    if (isAfterMorningStart() && !state.morningActivated) {
      activateMorningMode()
    }
  }

  function checkForceRest() {
    if (!isForceRestTime()) return
    if (state.dayPeriod === 'night_rest' || state.dayPeriod === 'sleep') return
    enterNightRest(true)
  }

  function pomodoroTotalSeconds(phase: PomodoroPhase) {
    switch (phase) {
      case 'resting':
        return REST_SECONDS
      case 'studyDone':
        return STUDY_DONE_GRACE_SECONDS
      case 'restDone':
        return REST_DONE_GRACE_SECONDS
      default:
        return STUDY_SECONDS
    }
  }

  function onStudyFinished() {
    pauseStudySegment()
    state.pomodoroPhase = 'studyDone'
    state.pomodoroRemaining = STUDY_DONE_GRACE_SECONDS
    playPomodoroSound(sounds.start)
    const recordingPeriod = state.activePomodoroPeriod
    if (recordingPeriod && isPomodoroPeriod(recordingPeriod)) {
      appendActivityLog({
        type: 'pomodoro_study_end',
        period: recordingPeriod,
        pomodoroRound: state.currentPomodoroRound,
        label: buildPomodoroStudyEndLabel(recordingPeriod, state.currentPomodoroRound),
      })
    }
    startCountdown(enterRest)
    persist()
  }

  function onRestFinished() {
    state.pomodoroPhase = 'restDone'
    state.pomodoroRemaining = REST_DONE_GRACE_SECONDS
    playPomodoroSound(sounds.start)
    const recordingPeriod = state.activePomodoroPeriod
    if (recordingPeriod && isPomodoroPeriod(recordingPeriod)) {
      appendActivityLog({
        type: 'pomodoro_rest_end',
        period: recordingPeriod,
        pomodoroRound: state.currentPomodoroRound,
        label: buildPomodoroRestEndLabel(recordingPeriod, state.currentPomodoroRound),
      })
    }
    startCountdown(startStudy)
    persist()
  }

  function startStudy(fromModeSwitch = false) {
    stopTimer()
    state.activity = 'pomodoro'
    state.pomodoroPhase = 'studying'
    state.pomodoroRemaining = STUDY_SECONDS

    const recordingPeriod = resolveRecordingPeriod()
    if (recordingPeriod) {
      if (!state.activePomodoroPeriod) {
        state.activePomodoroPeriod = recordingPeriod
      }
      state.currentPomodoroRound =
        getPomodoroCountForPeriod(state, state.activePomodoroPeriod) + 1
      appendActivityLog({
        type: 'pomodoro_study_start',
        period: state.activePomodoroPeriod,
        activity: 'pomodoro',
        pomodoroRound: state.currentPomodoroRound,
        label: buildPomodoroStudyStartLabel(
          state.activePomodoroPeriod,
          state.currentPomodoroRound,
        ),
      })
    }

    if (!fromModeSwitch) playPomodoroSound(sounds.classStart)
    ensureStudySegment()
    startCountdown(onStudyFinished)
    persist()
  }

  function enterRest() {
    if (state.pomodoroPhase !== 'studyDone') return
    stopTimer()

    const recordingPeriod = state.activePomodoroPeriod ?? resolveRecordingPeriod()
    if (recordingPeriod && isPomodoroPeriod(recordingPeriod)) {
      if (!state.activePomodoroPeriod) {
        state.activePomodoroPeriod = recordingPeriod
      }
      incrementPeriodPomodoro(state, recordingPeriod)
      appendActivityLog({
        type: 'pomodoro_round_complete',
        period: recordingPeriod,
        activity: 'pomodoro',
        pomodoroRound: state.currentPomodoroRound,
        label: buildPomodoroRoundLabel(recordingPeriod, state.currentPomodoroRound),
      })
      appendActivityLog({
        type: 'pomodoro_rest_start',
        period: recordingPeriod,
        activity: 'pomodoro',
        pomodoroRound: state.currentPomodoroRound,
        label: buildPomodoroRestStartLabel(recordingPeriod, state.currentPomodoroRound),
      })
    }

    state.pomodoroPhase = 'resting'
    state.pomodoroRemaining = REST_SECONDS
    playPomodoroSound(sounds.classEnd)
    startCountdown(onRestFinished)
    persist()
  }

  function endStudy() {
    enterRest()
  }

  function enterNoonMode() {
    if (state.morningCount < MORNING_NOON_MIN) return
    stopTimer()
    clearPomodoroSession()
    switchMode('noon', 'waiting_meal')
    state.pomodoroPhase = 'idle'
    persist()
  }

  function finishMeal() {
    stopTimer()
    switchMode('noon', 'free_hour')
    state.freeHourRemaining = FREE_HOUR_SECONDS
    state.freeHourPromptShown = false
    startCountdown(onFreeHourFinished)
    persist()
  }

  function onFreeHourFinished() {
    if (state.dayPeriod === 'noon') {
      switchMode('afternoon', 'pomodoro')
      clearPomodoroSession()
      startStudy(true)
    } else if (state.dayPeriod === 'evening') {
      switchMode('evening', 'pomodoro')
      clearPomodoroSession()
      startStudy(true)
    }
    persist()
  }

  function startStudyFromFreeHourPrompt() {
    stopTimer()
    if (state.dayPeriod === 'noon') {
      switchMode('afternoon', 'pomodoro')
    } else if (state.dayPeriod === 'evening') {
      switchMode('evening', 'pomodoro')
    }
    clearPomodoroSession()
    startStudy(true)
  }

  function startExercise() {
    if (state.activity !== 'free_hour' && state.activity !== 'free_hour_prompt') return
    stopTimer()
    clearCountdownDeadline()
    state.exerciseSegmentBaseSeconds = state.exerciseSeconds
    state.exerciseSegmentStartedAt = Date.now()
    state.activity = 'exercise'
    logActivityStart('exercise', state.dayPeriod)
    playActivitySwitchSound()
    ensureTimerLoop()
    persist()
  }

  function openExerciseCalorieForm() {
    if (state.activity !== 'exercise') return
    showExerciseCalorieForm.value = true
  }

  function cancelExerciseCalorieForm() {
    showExerciseCalorieForm.value = false
  }

  function confirmExerciseEnd(calories: number) {
    if (state.activity !== 'exercise') return false
    if (!Number.isFinite(calories) || calories <= 0) return false

    showExerciseCalorieForm.value = false
    finishExercise(Math.round(calories))
    return true
  }

  function finishExercise(calories: number) {
    syncExerciseFromClock()
    const segmentStartedAt = state.exerciseSegmentStartedAt ?? Date.now()
    const duration = Math.max(
      0,
      state.exerciseSeconds - state.exerciseSegmentBaseSeconds,
    )
    state.exerciseSegmentStartedAt = null
    logActivityEnd('exercise', state.dayPeriod)
    if (duration > 0) {
      appendExerciseEntry({
        durationSeconds: duration,
        calories,
        startedAt: segmentStartedAt,
        endedAt: Date.now(),
        period: state.dayPeriod,
      })
    }
    state.activity = state.freeHourPromptShown ? 'free_hour_prompt' : 'free_hour'
    playActivitySwitchSound()
    startCountdown(onFreeHourFinished)
    persist()
  }

  function endExercise() {
    openExerciseCalorieForm()
  }

  function openLaborPicker() {
    if (!canStartLaborNow()) return
    showLaborPicker.value = true
  }

  function cancelLaborPicker() {
    showLaborPicker.value = false
  }

  function startLabor(category: LaborCategory) {
    if (!canStartLaborNow()) return
    showLaborPicker.value = false

    state.laborResumeActivity = state.activity
    state.laborResumeFreeHourRemaining = state.freeHourRemaining
    state.laborResumeFreeHourPromptShown = state.freeHourPromptShown
    state.laborResumeNightRestRemaining = state.nightRestRemaining

    if (
      state.activity === 'free_hour' ||
      state.activity === 'free_hour_prompt' ||
      state.activity === 'night_rest_timer'
    ) {
      stopTimer()
      clearCountdownDeadline()
    }

    state.laborCategory = category
    state.laborSegmentBaseSeconds = state.laborSeconds
    state.laborSegmentStartedAt = Date.now()
    state.activity = 'labor'
    appendActivityLog({
      type: 'activity_start',
      period: state.dayPeriod,
      activity: 'labor',
      laborCategory: category,
      label: buildLaborStartLabel(state.dayPeriod, category),
    })
    playActivitySwitchSound()
    ensureTimerLoop()
    persist()
  }

  function endLabor() {
    if (state.activity !== 'labor') return
    syncLaborFromClock()

    const segmentStartedAt = state.laborSegmentStartedAt ?? Date.now()
    const duration = Math.max(0, state.laborSeconds - state.laborSegmentBaseSeconds)
    const category = state.laborCategory

    if (duration > 0 && category) {
      appendLaborEntry({
        category,
        durationSeconds: duration,
        startedAt: segmentStartedAt,
        endedAt: Date.now(),
        period: state.dayPeriod,
      })
    }
    logActivityEnd('labor', state.dayPeriod)

    state.laborSegmentStartedAt = null
    state.laborCategory = null

    const resumeActivity = state.laborResumeActivity
    state.laborResumeActivity = null

    if (resumeActivity === 'free_hour' || resumeActivity === 'free_hour_prompt') {
      state.freeHourRemaining = state.laborResumeFreeHourRemaining
      state.freeHourPromptShown = state.laborResumeFreeHourPromptShown
      state.laborResumeFreeHourRemaining = null
      state.activity = state.freeHourPromptShown ? 'free_hour_prompt' : 'free_hour'
      startCountdown(onFreeHourFinished)
    } else if (resumeActivity === 'night_rest_timer') {
      state.nightRestRemaining = state.laborResumeNightRestRemaining
      state.laborResumeNightRestRemaining = null
      state.activity = 'night_rest_timer'
      startCountdown(onNightRestFinished)
    } else {
      state.activity = 'waiting_meal'
    }

    playActivitySwitchSound()
    persist()
  }

  function enterEveningMode() {
    if (state.afternoonCount < AFTERNOON_EVENING_MIN) return
    stopTimer()
    clearPomodoroSession()
    switchMode('evening', 'free_hour')
    state.freeHourRemaining = FREE_HOUR_SECONDS
    state.freeHourPromptShown = false
    startCountdown(onFreeHourFinished)
    persist()
  }

  function enterNightRest(forced = false) {
    void forced
    stopTimer()
    clearPomodoroSession()
    switchMode('night_rest', 'night_rest_timer')
    state.nightRestRemaining = NIGHT_REST_SECONDS
    state.pomodoroPhase = 'idle'
    startCountdown(onNightRestFinished)
    persist()
  }

  function onNightRestFinished() {
    state.nightRestRemaining = 0
    switchMode('sleep', 'sleep_prompt', { playSound: false })
    playModeSwitchSound()
    persist()
  }

  function enterSleep() {
    switchMode('sleep', 'sleep_prompt', { playSound: true })
    stopTimer()
    clearCountdownDeadline()
    persist()
  }

  function startMidBreak() {
    if (state.activity !== 'pomodoro' || state.pomodoroPhase !== 'studying') return
    if (state.midBreakUsedSeconds >= MID_BREAK_DAILY_QUOTA) return
    pauseStudySegment()
    stopTimer()
    clearCountdownDeadline()
    state.pausedStudyRemaining = state.pomodoroRemaining
    state.activity = 'mid_break'
    state.midBreakSegmentBaseSeconds = state.midBreakUsedSeconds
    state.midBreakSegmentStartedAt = Date.now()
    appendActivityLog({
      type: 'activity_start',
      period: state.dayPeriod,
      activity: 'mid_break',
      label: `${PERIOD_LABELS[state.dayPeriod]} · 开始中途休整（剩余 ${formatTime(MID_BREAK_DAILY_QUOTA - state.midBreakUsedSeconds)}）`,
    })
    playActivitySwitchSound()
    ensureTimerLoop()
    persist()
  }

  function endMidBreak(forced = false) {
    if (state.activity !== 'mid_break') return
    syncMidBreakFromClock()
    stopTimer()
    state.midBreakSegmentStartedAt = null
    appendActivityLog({
      type: 'activity_end',
      period: state.dayPeriod,
      activity: 'mid_break',
      durationSeconds: state.midBreakUsedSeconds,
      label: forced
        ? `${PERIOD_LABELS[state.dayPeriod]} · 中途休整已达 30 分钟上限`
        : `${PERIOD_LABELS[state.dayPeriod]} · 结束中途休整，恢复学习`,
    })
    state.activity = 'pomodoro'
    state.pomodoroPhase = 'studying'
    state.pomodoroRemaining = state.pausedStudyRemaining
    ensureStudySegment()
    playActivitySwitchSound()
    startCountdown(onStudyFinished)
    persist()
  }

  function startRelaxedPomodoro() {
    if (!isPomodoroPeriod(state.dayPeriod)) return
    if (state.activity !== 'pomodoro') return
    if (!canUseRelaxedPomodoro()) return
    if (!consumeRelaxedQuota()) return

    if (state.pomodoroPhase === 'studying') pauseStudySegment()
    stopTimer()
    incrementPeriodPomodoro(state, state.dayPeriod, 2)

    appendActivityLog({
      type: 'pomodoro_round_complete',
      period: state.dayPeriod,
      activity: 'relaxed_pomodoro',
      label: `${PERIOD_LABELS[state.dayPeriod]} · 宽松番茄 +2 轮`,
    })

    state.activity = 'relaxed_pomodoro'
    state.relaxedPomodoroRemaining = RELAXED_POMODORO_SECONDS
    state.pomodoroPhase = 'idle'
    appendActivityLog({
      type: 'activity_start',
      period: state.dayPeriod,
      activity: 'relaxed_pomodoro',
      label: `${PERIOD_LABELS[state.dayPeriod]} · 开始宽松番茄休息 2 小时`,
    })
    playActivitySwitchSound()
    startCountdown(onRelaxedPomodoroFinished)
    persist()
  }

  function onRelaxedPomodoroFinished() {
    appendActivityLog({
      type: 'activity_end',
      period: state.dayPeriod,
      activity: 'relaxed_pomodoro',
      label: `${PERIOD_LABELS[state.dayPeriod]} · 宽松番茄休息结束`,
    })
    state.relaxedPomodoroRemaining = null
    state.activity = 'pomodoro'
    playActivitySwitchSound()
    startStudy(true)
  }

  const relaxedWeekRemainingDisplay = computed(() =>
    formatTime(getRelaxedWeekRemaining()),
  )

  const midBreakRemainingDisplay = computed(() => {
    void clockNow.value
    return formatTime(Math.max(0, MID_BREAK_DAILY_QUOTA - getMidBreakUsedNow()))
  })

  const displayTime = computed(() => {
    void clockNow.value
    if (state.activity === 'exercise') return formatTime(getExerciseSecondsNow())
    if (state.activity === 'labor') return formatTime(getLaborSecondsNow())
    if (state.activity === 'mid_break') {
      return formatTime(Math.max(0, MID_BREAK_DAILY_QUOTA - getMidBreakUsedNow()))
    }
    if (state.activity === 'before_morning' || state.activity === 'waiting_meal') return '--:--'
    return formatTime(getRemainingSeconds())
  })

  const totalSeconds = computed(() => {
    if (state.activity === 'free_hour' || state.activity === 'free_hour_prompt') {
      return FREE_HOUR_SECONDS
    }
    if (state.activity === 'night_rest_timer' || state.activity === 'sleep_prompt') {
      return NIGHT_REST_SECONDS
    }
    if (state.activity === 'relaxed_pomodoro') {
      return RELAXED_POMODORO_SECONDS
    }
    if (state.activity === 'mid_break') {
      return MID_BREAK_DAILY_QUOTA
    }
    if (state.activity === 'exercise') {
      return state.exerciseSeconds || 1
    }
    if (state.activity === 'labor') {
      return getLaborSecondsNow() || 1
    }
    return pomodoroTotalSeconds(state.pomodoroPhase)
  })

  const progressPercent = computed(() => {
    void clockNow.value
    if (state.activity === 'before_morning') return 0
    if (state.activity === 'waiting_meal') return 0
    if (state.activity === 'exercise') {
      return 0
    }
    if (state.activity === 'labor') {
      return 0
    }
    if (state.activity === 'mid_break') {
      return Math.min(100, (getMidBreakUsedNow() / MID_BREAK_DAILY_QUOTA) * 100)
    }
    if (state.activity === 'sleep_prompt' && state.dayPeriod === 'sleep') {
      return 100
    }
    const remaining = getRemainingSeconds()
    const total = totalSeconds.value
    const elapsed = total - remaining
    return Math.min(100, (elapsed / total) * 100)
  })

  const ringOffset = computed(
    () => RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * progressPercent.value) / 100,
  )

  const ringClass = computed(() => {
    if (
      state.activity === 'free_hour' ||
      state.activity === 'free_hour_prompt' ||
      state.activity === 'relaxed_pomodoro' ||
      state.activity === 'mid_break' ||
      state.activity === 'labor'
    ) {
      return 'timer-ring__progress--rest'
    }
    if (state.activity === 'night_rest_timer') return 'timer-ring__progress--rest'
    if (state.pomodoroPhase === 'resting') return 'timer-ring__progress--rest'
    if (state.pomodoroPhase === 'studyDone' || state.pomodoroPhase === 'restDone') {
      return 'timer-ring__progress--alert'
    }
    return ''
  })

  const periodLabel = computed(() => PERIOD_LABELS[state.dayPeriod])

  const modeLabel = computed(() => {
    if (state.activity === 'before_morning') return '等待早上 9 点开始'
    if (state.activity === 'waiting_meal') return `${periodLabel.value} · 等待用餐`
    if (state.activity === 'free_hour') return `${periodLabel.value} · 自由 1 小时`
    if (state.activity === 'free_hour_prompt') return `${periodLabel.value} · 可以开始学习`
    if (state.activity === 'exercise') return `${periodLabel.value} · 锻炼中`
    if (state.activity === 'labor') {
      const label = state.laborCategory
        ? LABOR_CATEGORY_LABELS[state.laborCategory]
        : '劳动'
      return `${periodLabel.value} · ${label}中`
    }
    if (state.activity === 'mid_break') return `${periodLabel.value} · 中途休整`
    if (state.activity === 'relaxed_pomodoro') return `${periodLabel.value} · 宽松番茄休息`
    if (state.activity === 'night_rest_timer') return `${periodLabel.value} · 休息 30 分钟`
    if (state.activity === 'sleep_prompt') return `${periodLabel.value} · 该睡觉了`

    switch (state.pomodoroPhase) {
      case 'studying':
        return `${periodLabel.value} · 上课中`
      case 'studyDone':
        return `${periodLabel.value} · 可以下课了`
      case 'resting':
        return `${periodLabel.value} · 休息中`
      case 'restDone':
        return `${periodLabel.value} · 该上课了`
      default:
        return `${periodLabel.value} · 番茄时间`
    }
  })

  const hintText = computed(() => {
    if (!audioUnlockedRef.value) return '请先点击页面任意位置，启用音效'
    if (state.activity === 'before_morning') return '早上 9 点自动进入番茄学习'
    if (state.activity === 'waiting_meal') return '用餐结束后点击「吃饭完毕」'
    if (state.activity === 'free_hour') return '自由休息，55 分钟后可提前开始学习'
    if (state.activity === 'free_hour_prompt') return '休息已满 55 分钟，可开始学习'
    if (state.activity === 'exercise') return '锻炼结束后点击「锻炼完毕」'
    if (state.activity === 'labor') return '劳动结束后点击「劳动完毕」'
    if (state.activity === 'mid_break') {
      return `休整剩余 ${midBreakRemainingDisplay.value}，点击结束恢复学习`
    }
    if (state.activity === 'relaxed_pomodoro') {
      return '宽松休息 2 小时，本段番茄 +2'
    }
    if (state.activity === 'night_rest_timer') return '放松休息，30 分钟后提示睡眠'
    if (state.activity === 'sleep_prompt') return '请准备进入睡眠时间'

    switch (state.pomodoroPhase) {
      case 'studying':
        return '专注学习中…'
      case 'studyDone':
        return '请点击「结束学习」，10 分钟后自动休息'
      case 'resting':
        return '好好休息…'
      case 'restDone':
        return '请点击「开始学习」，3 分钟后自动上课'
      default:
        return '点击开始学习'
    }
  })

  const periodPomodoroCount = computed(() => getPeriodPomodoroCount(state))

  const periodPomodoroCountLabel = computed(() => {
    const completed = periodPomodoroCount.value
    if (
      state.activity === 'pomodoro' &&
      state.currentPomodoroRound > completed &&
      (state.pomodoroPhase === 'studying' ||
        state.pomodoroPhase === 'studyDone' ||
        state.pomodoroPhase === 'resting' ||
        state.pomodoroPhase === 'restDone')
    ) {
      return `${completed} 轮 · 第 ${state.currentPomodoroRound} 轮进行中`
    }
    return `${completed} 轮`
  })

  const primaryAction = computed(() => {
    if (state.activity === 'mid_break') {
      return { label: '结束休整', action: 'endMidBreak' as const }
    }
    if (state.activity === 'free_hour_prompt') {
      return { label: '开始学习', action: 'earlyStudy' as const }
    }
    if (state.activity === 'waiting_meal') {
      return { label: '吃饭完毕', action: 'mealDone' as const }
    }
    if (state.activity === 'exercise') {
      return { label: '锻炼完毕', action: 'exerciseDone' as const }
    }
    if (state.activity === 'labor') {
      return { label: '劳动完毕', action: 'laborDone' as const }
    }
    if (state.activity === 'sleep_prompt') {
      return { label: '准备睡觉', action: 'sleep' as const }
    }
    if (state.activity === 'pomodoro') {
      if (state.pomodoroPhase === 'idle' || state.pomodoroPhase === 'restDone') {
        return { label: '开始学习', action: 'start' as const }
      }
      if (state.pomodoroPhase === 'studyDone') {
        return { label: '结束学习', action: 'end' as const }
      }
    }
    return null
  })

  const secondaryActions = computed(() => {
    void clockNow.value
    const actions: { label: string; action: string; disabled?: boolean; hint?: string }[] = []

    if (
      state.activity === 'pomodoro' &&
      state.pomodoroPhase === 'studying' &&
      state.midBreakUsedSeconds < MID_BREAK_DAILY_QUOTA
    ) {
      actions.push({
        label: '中途休整',
        action: 'midBreak',
        hint: `剩余 ${midBreakRemainingDisplay.value}`,
      })
    }

    if (
      isPomodoroPeriod(state.dayPeriod) &&
      state.activity === 'pomodoro' &&
      (state.pomodoroPhase === 'idle' ||
        state.pomodoroPhase === 'studying' ||
        state.pomodoroPhase === 'restDone' ||
        state.pomodoroPhase === 'studyDone')
    ) {
      actions.push({
        label: '宽松番茄',
        action: 'relaxedPomodoro',
        disabled: !canUseRelaxedPomodoro(),
        hint: `本周剩余 ${relaxedWeekRemainingDisplay.value}`,
      })
    }

    if (state.activity === 'free_hour' || state.activity === 'free_hour_prompt') {
      actions.push({ label: '开始锻炼', action: 'exercise' })
    }

    if (canStartLaborNow()) {
      actions.push({ label: '进行劳动', action: 'labor' })
    }

    if (state.dayPeriod === 'morning' && state.activity === 'pomodoro') {
      actions.push({
        label: '进入中午模式',
        action: 'noon',
        disabled: state.morningCount < MORNING_NOON_MIN,
        hint: state.morningCount >= MORNING_NOON_MIN ? '可继续番茄，不必立即切换' : undefined,
      })
    }

    if (state.dayPeriod === 'afternoon' && state.activity === 'pomodoro') {
      actions.push({
        label: '进入晚上模式',
        action: 'evening',
        disabled: state.afternoonCount < AFTERNOON_EVENING_MIN,
        hint: state.afternoonCount >= AFTERNOON_EVENING_MIN ? '可继续番茄，不必立即切换' : undefined,
      })
    }

    if (state.dayPeriod === 'evening' && state.activity === 'pomodoro') {
      actions.push({
        label: '进入休息模式',
        action: 'nightRest',
        disabled: state.eveningCount < EVENING_REST_MIN,
        hint: state.eveningCount >= EVENING_REST_MIN ? '可继续番茄，不必立即切换' : undefined,
      })
    }

    return actions
  })

  function handlePrimaryAction() {
    unlockAudio()
    const action = primaryAction.value?.action
    if (action === 'endMidBreak') endMidBreak()
    if (action === 'start') startStudy()
    if (action === 'end') endStudy()
    if (action === 'earlyStudy') startStudyFromFreeHourPrompt()
    if (action === 'mealDone') finishMeal()
    if (action === 'exerciseDone') endExercise()
    if (action === 'laborDone') endLabor()
    if (action === 'sleep') enterSleep()
  }

  function handleSecondaryAction(action: string) {
    unlockAudio()
    if (action === 'midBreak') startMidBreak()
    if (action === 'relaxedPomodoro') startRelaxedPomodoro()
    if (action === 'exercise') startExercise()
    if (action === 'labor') openLaborPicker()
    if (action === 'noon') enterNoonMode()
    if (action === 'evening') enterEveningMode()
    if (action === 'nightRest') enterNightRest()
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') handleAppVisible()
    else handleAppHidden()
  }

  function migratePomodoroSessionState() {
    if (
      state.activity === 'pomodoro' &&
      !state.activePomodoroPeriod &&
      isPomodoroPeriod(state.dayPeriod)
    ) {
      state.activePomodoroPeriod = state.dayPeriod
      if (
        state.currentPomodoroRound === 0 &&
        (state.pomodoroPhase === 'studying' ||
          state.pomodoroPhase === 'studyDone' ||
          state.pomodoroPhase === 'resting' ||
          state.pomodoroPhase === 'restDone')
      ) {
        state.currentPomodoroRound =
          getPomodoroCountForPeriod(state, state.dayPeriod) + 1
      }
    }
    syncLegacyTodayCount(getTotalPomodoroCount(state))
  }

  onMounted(() => {
    bumpClock()
    migratePomodoroSessionState()
    checkMorningStart()
    checkForceRest()
    resumeTimersAfterLoad()
    startWatchdog()

    tickId = setInterval(() => {
      checkMorningStart()
      checkForceRest()
    }, 30_000)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleAppVisible)
    window.addEventListener('pageshow', handleAppVisible)
  })

  onUnmounted(() => {
    stopTimer()
    stopWatchdog()
    if (tickId) clearInterval(tickId)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleAppVisible)
    window.removeEventListener('pageshow', handleAppVisible)
  })

  return {
    state,
    todayCount,
    displayTime,
    relaxedWeekRemainingDisplay,
    midBreakRemainingDisplay,
    modeLabel,
    hintText,
    periodLabel,
    periodPomodoroCount,
    periodPomodoroCountLabel,
    ringOffset,
    ringClass,
    primaryAction,
    secondaryActions,
    handlePrimaryAction,
    handleSecondaryAction,
    showLaborPicker,
    showExerciseCalorieForm,
    startLabor,
    cancelLaborPicker,
    cancelExerciseCalorieForm,
    confirmExerciseEnd,
    LABOR_CATEGORY_LABELS,
  }
}
