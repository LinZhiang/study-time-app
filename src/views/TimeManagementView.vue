<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LABOR_CATEGORIES, useTimeManagement } from '../composables/useTimeManagement'

const {
  state,
  todayCount,
  displayTime,
  relaxedWeekRemainingDisplay,
  midBreakRemainingDisplay,
  modeLabel,
  hintText,
  periodLabel,
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
  backgroundRuntimeEnabled,
  toggleBackgroundRuntime,
  isTodayPaused,
} = useTimeManagement()

const exerciseCalorieInput = ref('')
const exerciseCalorieError = ref('')

watch(showExerciseCalorieForm, (visible) => {
  if (visible) {
    exerciseCalorieInput.value = ''
    exerciseCalorieError.value = ''
  }
})

function submitExerciseCalories() {
  const calories = Number(exerciseCalorieInput.value)
  if (!exerciseCalorieInput.value.trim() || !Number.isFinite(calories) || calories <= 0) {
    exerciseCalorieError.value = '请填写大于 0 的卡路里'
    return
  }
  if (!confirmExerciseEnd(calories)) {
    exerciseCalorieError.value = '请填写大于 0 的卡路里'
  }
}

const isTimerRunning = computed(() => {
  if (state.activity === 'before_morning') return false
  if (state.activity === 'waiting_meal') return false
  if (state.activity === 'exercise') return true
  if (state.activity === 'labor') return true
  if (state.activity === 'mid_break') return true
  if (state.activity === 'relaxed_pomodoro') return true
  if (state.activity === 'free_hour' || state.activity === 'free_hour_prompt') return true
  if (state.activity === 'night_rest_timer') return true
  return (
    state.pomodoroPhase === 'studying' ||
    state.pomodoroPhase === 'resting' ||
    state.pomodoroPhase === 'studyDone' ||
    state.pomodoroPhase === 'restDone'
  )
})
</script>

<template>
  <div class="page time-page">
    <section v-if="isTodayPaused()" class="card pause-day-banner">
      <p class="pause-day-banner__title">今日为休整日</p>
      <p class="pause-day-banner__desc">不计统计、不播放提醒。可在底部「休整日」栏目调整安排。</p>
    </section>

    <section class="daily-stats card">
      <div class="daily-stats__item">
        <span class="daily-stats__value">{{ midBreakRemainingDisplay }}</span>
        <span class="daily-stats__label">休整剩余</span>
      </div>
      <div class="daily-stats__divider" />
      <div class="daily-stats__item">
        <span class="daily-stats__value">{{ relaxedWeekRemainingDisplay }}</span>
        <span class="daily-stats__label">宽松本周</span>
      </div>
    </section>

    <section class="card background-runtime-card">
      <div class="background-runtime-card__row">
        <div>
          <p class="background-runtime-card__title">后台计时</p>
          <p class="background-runtime-card__desc">
            切到后台仍按时间戳继续计时，到点会发系统通知（需允许通知权限）
          </p>
        </div>
        <button
          class="toggle-switch"
          :class="{ 'toggle-switch--on': backgroundRuntimeEnabled }"
          type="button"
          role="switch"
          :aria-checked="backgroundRuntimeEnabled"
          @click="toggleBackgroundRuntime"
        >
          <span class="toggle-switch__thumb" />
        </button>
      </div>
    </section>

    <div class="time-page__body">
      <section class="card timer-card time-page__timer">
        <p class="timer-card__mode">{{ modeLabel }}</p>

        <div class="timer-ring">
          <svg class="timer-ring__svg" viewBox="0 0 200 200">
            <circle class="timer-ring__track" cx="100" cy="100" r="88" />
            <circle
              class="timer-ring__progress"
              :class="ringClass"
              cx="100"
              cy="100"
              r="88"
              :style="{ strokeDashoffset: ringOffset }"
            />
          </svg>
          <div class="timer-ring__center">
            <span class="timer-ring__time">{{ displayTime }}</span>
            <span class="timer-ring__hint">{{ hintText }}</span>
          </div>
        </div>

        <div class="timer-actions">
          <button
            v-if="primaryAction"
            class="btn btn--primary btn--large"
            type="button"
            @click="handlePrimaryAction"
          >
            {{ primaryAction.label }}
          </button>
          <p v-else class="timer-actions__waiting">
            {{ isTimerRunning ? '计时进行中' : '' }}
          </p>
        </div>

        <div v-if="secondaryActions.length" class="secondary-actions">
          <button
            v-for="item in secondaryActions"
            :key="item.action"
            class="btn btn--ghost btn--small"
            type="button"
            :disabled="item.disabled"
            @click="handleSecondaryAction(item.action)"
          >
            {{ item.label }}
            <span v-if="item.hint" class="btn__hint">（{{ item.hint }}）</span>
            <span v-else-if="item.disabled && item.action === 'noon'" class="btn__hint">（需 2 轮番茄）</span>
            <span v-else-if="item.disabled && item.action === 'evening'" class="btn__hint">（需 4 轮番茄）</span>
            <span v-else-if="item.disabled && item.action === 'nightRest'" class="btn__hint">（需 2 轮番茄）</span>
          </button>
        </div>
      </section>

      <div class="time-page__aside">
        <section class="pomodoro-summary">
          <div class="pomodoro-summary__card">
            <span class="pomodoro-summary__value">{{ todayCount }}</span>
            <span class="pomodoro-summary__label">今日番茄</span>
          </div>
          <div class="pomodoro-summary__info card">
            <div class="info-row">
              <span class="info-row__label">当前时段</span>
              <span class="info-row__value">{{ periodLabel }}</span>
            </div>
            <div class="info-row">
              <span class="info-row__label">本段番茄</span>
              <span class="info-row__value">{{ periodPomodoroCountLabel }}</span>
            </div>
          </div>
        </section>

        <section class="phase-guide card">
          <h2 class="phase-guide__title">日程流程</h2>
          <ol class="phase-guide__list">
            <li :class="{ 'phase-guide__item--active': state.dayPeriod === 'morning' }">
              9:00 早上模式，默认番茄学习
            </li>
            <li :class="{ 'phase-guide__item--active': state.dayPeriod === 'noon' }">
              至少 2 轮后可进中午（可继续学）→ 吃饭完毕 → 自由 1 小时
            </li>
            <li :class="{ 'phase-guide__item--active': state.dayPeriod === 'afternoon' }">
              55 分钟可提前学习，1 小时到 → 下午番茄（可持续多轮）
            </li>
            <li :class="{ 'phase-guide__item--active': state.dayPeriod === 'evening' }">
              至少 4 轮后可进晚上（可继续学）→ 先休息 1 小时再番茄
            </li>
            <li :class="{ 'phase-guide__item--active': state.dayPeriod === 'night_rest' || state.dayPeriod === 'sleep' }">
              至少 2 轮或 23:00 强制 → 休息 30 分钟 → 睡眠
            </li>
            <li>宽松番茄：每周 2 小时，休息 2 小时并 +2 轮番茄</li>
            <li>中途休整：每天 30 分钟，学习期间可暂停恢复</li>
          </ol>
        </section>
      </div>
    </div>

    <div v-if="showExerciseCalorieForm" class="labor-picker">
      <div class="labor-picker__panel card">
        <h3 class="labor-picker__title">填写消耗卡路里</h3>
        <p class="labor-picker__hint">请填写本次锻炼一共消耗的卡路里（千卡）</p>
        <label class="calorie-form__field">
          <span class="calorie-form__label">消耗卡路里</span>
          <input
            v-model="exerciseCalorieInput"
            class="calorie-form__input"
            type="number"
            min="1"
            step="1"
            inputmode="numeric"
            placeholder="例如 180"
            @keydown.enter.prevent="submitExerciseCalories"
          />
        </label>
        <p v-if="exerciseCalorieError" class="calorie-form__error">{{ exerciseCalorieError }}</p>
        <button class="btn btn--primary btn--large calorie-form__submit" type="button" @click="submitExerciseCalories">
          确认结束锻炼
        </button>
        <button class="btn btn--ghost btn--small labor-picker__cancel" type="button" @click="cancelExerciseCalorieForm">
          继续锻炼
        </button>
      </div>
    </div>

    <div v-if="showLaborPicker" class="labor-picker">
      <div class="labor-picker__panel card">
        <h3 class="labor-picker__title">选择劳动类型</h3>
        <p class="labor-picker__hint">记录做饭、清洁、准备考试资料等额外劳动时间</p>
        <div class="labor-picker__options">
          <button
            v-for="category in LABOR_CATEGORIES"
            :key="category"
            class="btn btn--ghost"
            type="button"
            @click="startLabor(category)"
          >
            {{ LABOR_CATEGORY_LABELS[category] }}
          </button>
        </div>
        <button class="btn btn--ghost btn--small labor-picker__cancel" type="button" @click="cancelLaborPicker">
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.time-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.time-page__body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  width: 100%;
}

.time-page__aside {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.time-page__timer {
  min-width: 0;
}

@media (min-width: 768px) {
  .time-page__body {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .timer-ring {
    width: 260px;
    height: 260px;
  }

  .timer-ring__time {
    font-size: 48px;
  }

  .secondary-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .time-page__body {
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1fr);
    gap: 24px;
  }

  .timer-ring {
    width: 300px;
    height: 300px;
  }

  .timer-card {
    padding: 28px 24px 24px;
  }

  .pomodoro-summary {
    flex-direction: column;
  }

  .pomodoro-summary__card {
    width: 100%;
    padding: 20px;
  }

  .daily-stats__value {
    font-size: 22px;
  }
}

.pause-day-banner {
  padding: 14px 16px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.pause-day-banner__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #c45c26;
}

.pause-day-banner__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.daily-stats {
  display: flex;
  align-items: center;
  padding: 16px 12px;
}

.daily-stats__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.daily-stats__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.daily-stats__label {
  font-size: 11px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.daily-stats__divider {
  width: 1px;
  height: 32px;
  background: var(--color-border);
  flex-shrink: 0;
}

.background-runtime-card {
  padding: 14px 16px;
}

.background-runtime-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.background-runtime-card__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.background-runtime-card__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.toggle-switch {
  position: relative;
  width: 52px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--color-border);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s ease;
}

.toggle-switch--on {
  background: var(--color-primary);
}

.toggle-switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 18%);
  transition: transform 0.2s ease;
}

.toggle-switch--on .toggle-switch__thumb {
  transform: translateX(20px);
}

.timer-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px 20px;
  gap: 20px;
}

.timer-card__mode {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
}

.timer-ring {
  position: relative;
  width: 220px;
  height: 220px;
}

.timer-ring__svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-ring__track {
  fill: none;
  stroke: var(--color-border);
  stroke-width: 8;
}

.timer-ring__progress {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 553;
  stroke-dashoffset: 553;
  transition: stroke-dashoffset 0.3s ease, stroke 0.3s ease;
}

.timer-ring__progress--rest {
  stroke: #3d7ea6;
}

.timer-ring__progress--alert {
  stroke: #c45c26;
}

.timer-ring__center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.timer-ring__time {
  font-size: 42px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1px;
  color: var(--color-text);
}

.timer-ring__hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 0 12px;
}

.timer-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 52px;
}

.timer-actions__waiting {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.secondary-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.secondary-actions .btn {
  width: 100%;
}

.btn__hint {
  font-size: 11px;
  margin-left: 4px;
}

.pomodoro-summary {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.pomodoro-summary__card {
  flex-shrink: 0;
  width: 108px;
  padding: 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.pomodoro-summary__value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

.pomodoro-summary__label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.pomodoro-summary__info {
  flex: 1;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.info-row__label {
  color: var(--color-text-secondary);
}

.info-row__value {
  font-weight: 600;
  color: var(--color-text);
}

.phase-guide {
  padding: 18px 20px;
}

.phase-guide__title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.phase-guide__list {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.phase-guide__item--active {
  color: var(--color-primary);
  font-weight: 600;
}

.labor-picker {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  padding-bottom: calc(var(--nav-height) + var(--safe-bottom) + 16px);
  background: rgba(0, 0, 0, 0.35);
}

.labor-picker__panel {
  width: 100%;
  max-width: 480px;
  padding: 20px;
}

.labor-picker__title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
}

.labor-picker__hint {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.labor-picker__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.labor-picker__cancel {
  width: 100%;
}

.calorie-form__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.calorie-form__label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.calorie-form__input {
  width: 100%;
  padding: 12px 14px;
  font-size: 18px;
  font-weight: 600;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
}

.calorie-form__input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.calorie-form__error {
  margin: -4px 0 12px;
  font-size: 12px;
  color: #c62828;
}

.calorie-form__submit {
  width: 100%;
  margin-bottom: 10px;
}
</style>
