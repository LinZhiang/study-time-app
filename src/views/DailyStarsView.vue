<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import type { DailyStarsDisplayState, StaminaManualStars } from '../types/dailyStars'
import { STAMINA_CALORIE_THRESHOLD } from '../types/dailyStars'
import { MONEY_BASE_BALANCE, MONEY_DAILY_INCREMENT } from '../types/moneySpend'
import {
  calculateStaminaAutoStars,
  formatExerciseDurationForStars,
  formatStarCount,
  formatStudyDuration,
} from '../utils/dailyStars'
import { formatExerciseCalories, loadTodayExerciseRecord } from '../utils/exerciseRecord'
import {
  formatArchivedDateLabel,
  formatDailyStarsStartDate,
  getDailyStarsDisplayState,
} from '../utils/dailyStarsArchive'
import { loadTodayStaminaManual, setTodayStaminaManual } from '../utils/staminaRecord'
import {
  formatMoneyAmount,
  formatMoneyEntryTime,
  getTodayMoneySpendSnapshot,
  loadTodayMoneySpend,
  submitTodayMoneySpend,
} from '../utils/moneySpendRecord'
import {
  loadTodayCleanliness,
  setTodayCleanlinessMaintained,
} from '../utils/cleanlinessRecord'

const displayState = ref<DailyStarsDisplayState>(getDailyStarsDisplayState())
const manualStaminaStars = ref<StaminaManualStars>(loadTodayStaminaManual())
const todayExerciseCalories = ref(loadTodayExerciseRecord().totalCalories)
const moneySpend = ref(loadTodayMoneySpend())
const moneySnapshot = ref(getTodayMoneySpendSnapshot())
const moneyHasSpending = ref(true)
const moneySpentInput = ref('')
const moneySubmitError = ref('')
const moneySubmitSuccess = ref('')
const cleanlinessMaintained = ref(loadTodayCleanliness().maintained)

function refresh() {
  displayState.value = getDailyStarsDisplayState()
  manualStaminaStars.value = loadTodayStaminaManual()
  todayExerciseCalories.value = loadTodayExerciseRecord().totalCalories
  moneySpend.value = loadTodayMoneySpend()
  moneySnapshot.value = getTodayMoneySpendSnapshot()
  moneyHasSpending.value = moneySpend.value.entries.length > 0 ? true : !moneySpend.value.noSpendConfirmed
  moneySpentInput.value = ''
  moneySubmitError.value = ''
  moneySubmitSuccess.value = ''
  cleanlinessMaintained.value = loadTodayCleanliness().maintained
}

const breakdown = computed(() =>
  displayState.value.status === 'ready' ? displayState.value.breakdown : null,
)

const laborTotalDisplay = computed(() =>
  breakdown.value ? formatStudyDuration(breakdown.value.laborSeconds) : '--',
)
const exerciseCaloriesDisplay = computed(() =>
  breakdown.value ? formatExerciseCalories(breakdown.value.exerciseCalories) : '--',
)
const exerciseDurationDisplay = computed(() =>
  breakdown.value
    ? formatExerciseDurationForStars(breakdown.value.exerciseDurationSeconds)
    : '--',
)
const studyDurationDisplay = computed(() =>
  breakdown.value ? formatStudyDuration(breakdown.value.studySeconds) : '--',
)

const totalStarsDisplay = computed(() => {
  if (!breakdown.value) return ''
  const total = breakdown.value.totalStars
  if (total <= 0) return formatStarCount(total)
  return formatStarCount(total, Math.max(6, total))
})

const laborStarsDisplay = computed(() =>
  breakdown.value ? formatStarCount(breakdown.value.laborStars) : '',
)
const exerciseStarsDisplay = computed(() =>
  breakdown.value ? formatStarCount(breakdown.value.exerciseStars, 2) : '',
)
const perseveranceStarsDisplay = computed(() =>
  breakdown.value ? formatStarCount(breakdown.value.perseveranceStars, 1) : '',
)
const staminaStarsDisplay = computed(() => {
  if (breakdown.value) {
    return formatStarCount(breakdown.value.staminaStars, 2)
  }
  const preview = calculateStaminaAutoStars(todayExerciseCalories.value) + manualStaminaStars.value
  return formatStarCount(preview, 2)
})
const cleanlinessStarsDisplay = computed(() => {
  if (breakdown.value) {
    return formatStarCount(breakdown.value.cleanlinessStars, 1)
  }
  return formatStarCount(cleanlinessMaintained.value ? 1 : 0, 1)
})
const perseveranceMetaDisplay = computed(() =>
  breakdown.value ? `运动 ${exerciseDurationDisplay.value} · 学习 ${studyDurationDisplay.value}` : '',
)
const staminaMetaDisplay = computed(() => {
  if (breakdown.value) {
    const parts = [`大卡 ${formatExerciseCalories(breakdown.value.exerciseCalories)}`]
    if (breakdown.value.staminaAutoStars > 0) parts.push('自动 +1')
    if (breakdown.value.staminaManualStars === 1) parts.push('手动 +1')
    if (breakdown.value.staminaManualStars === -1) parts.push('手动 −1')
    return parts.join(' · ')
  }
  const parts = [`大卡 ${formatExerciseCalories(todayExerciseCalories.value)}`]
  if (calculateStaminaAutoStars(todayExerciseCalories.value) > 0) parts.push('预计自动 +1')
  if (manualStaminaStars.value === 1) parts.push('手动 +1')
  if (manualStaminaStars.value === -1) parts.push('手动 −1')
  return parts.join(' · ')
})

const headerSubtitle = computed(() => {
  if (displayState.value.status === 'ready') {
    return `${formatArchivedDateLabel(displayState.value.date)} · 已结算`
  }
  return '待结算'
})

const pendingMessage = computed(() => {
  if (displayState.value.status === 'before_start') {
    return `日常星级自 ${formatDailyStarsStartDate(displayState.value.startDate)} 起统计（不含 6 月 29 日）。当日 24:00 结束后才会生成星级，今日暂不可查看。`
  }
  if (displayState.value.status === 'waiting_day_end') {
    return '今日数据仍在累计中。请等到当天 24:00 结束后，次日在此查看已结算的日常星级。'
  }
  return ''
})

const showStaminaManualPanel = computed(
  () => displayState.value.status === 'waiting_day_end',
)

const showMoneyPanel = computed(() => displayState.value.status === 'waiting_day_end')

const showCleanlinessPanel = computed(() => displayState.value.status === 'waiting_day_end')

const moneyMetaDisplay = computed(() => {
  if (breakdown.value) {
    const parts = [
      `余额 ${formatMoneyAmount(breakdown.value.moneyWalletBalance)}`,
      `消费 ${formatMoneyAmount(breakdown.value.moneySpent)}`,
    ]
    if (!breakdown.value.moneySubmitted) parts.push('未提交')
    return parts.join(' · ')
  }
  const parts = [
    `余额 ${formatMoneyAmount(moneySnapshot.value.walletBalance)}`,
    `今日 +${MONEY_DAILY_INCREMENT}`,
  ]
  if (moneySpend.value.submitted) {
    if (moneySpend.value.noSpendConfirmed) {
      parts.push('已确认无消费')
    } else if ((moneySpend.value.spent ?? 0) > 0) {
      parts.push(`今日累计 ${formatMoneyAmount(moneySpend.value.spent ?? 0)}`)
    }
  }
  return parts.join(' · ')
})

const todayMoneyTotal = computed(() => moneySpend.value.spent ?? 0)

const canConfirmNoSpend = computed(
  () => moneySpend.value.entries.length === 0 && !moneySpend.value.noSpendConfirmed,
)

function applyManualStamina(stars: StaminaManualStars) {
  manualStaminaStars.value = stars
  setTodayStaminaManual(stars)
}

function submitMoneySpend() {
  moneySubmitError.value = ''
  moneySubmitSuccess.value = ''
  if (moneyHasSpending.value) {
    const amount = Number(String(moneySpentInput.value).trim())
    if (!String(moneySpentInput.value).trim() || !Number.isFinite(amount) || amount <= 0) {
      moneySubmitError.value = '请填写大于 0 的消费金额'
      return
    }
    if (!submitTodayMoneySpend(true, amount)) {
      moneySubmitError.value = '提交失败，请检查金额'
      return
    }
    moneySubmitSuccess.value = `已记录 ${formatMoneyAmount(amount)}`
  } else if (!submitTodayMoneySpend(false, 0)) {
    moneySubmitError.value = '已有消费记录，无法再确认无消费'
    return
  } else {
    moneySubmitSuccess.value = '已确认今日无消费'
  }

  moneySpend.value = loadTodayMoneySpend()
  moneySnapshot.value = getTodayMoneySpendSnapshot()
  moneyHasSpending.value = moneySpend.value.entries.length > 0 ? true : !moneySpend.value.noSpendConfirmed
  moneySpentInput.value = ''
}

function toggleCleanlinessMaintained() {
  cleanlinessMaintained.value = !cleanlinessMaintained.value
  setTodayCleanlinessMaintained(cleanlinessMaintained.value)
}

onActivated(refresh)
refresh()
</script>

<template>
  <div class="page stars-page">
    <section v-if="displayState.status !== 'ready'" class="card pending-card">
      <h2 class="pending-card__title">尚未结算</h2>
      <p class="pending-card__text">{{ pendingMessage }}</p>
    </section>

    <section v-if="showStaminaManualPanel" class="card stamina-panel">
      <h3 class="stamina-panel__title">体力 · 手动调整</h3>
      <p class="stamina-panel__hint">
        日终结算时，运动大卡 ≥{{ STAMINA_CALORIE_THRESHOLD }} 自动 +1 星。你可补充记录昨晚休息情况：
      </p>
      <div class="stamina-panel__preview">
        <span class="stamina-panel__preview-label">当前预计</span>
        <span class="stamina-panel__preview-stars">{{ staminaStarsDisplay }}</span>
        <span class="stamina-panel__preview-meta">{{ staminaMetaDisplay }}</span>
      </div>
      <div class="stamina-panel__actions">
        <button
          class="btn btn--ghost btn--small"
          :class="{ 'stamina-panel__btn--active': manualStaminaStars === 1 }"
          type="button"
          @click="applyManualStamina(1)"
        >
          +1 休息良好
        </button>
        <button
          class="btn btn--ghost btn--small"
          :class="{ 'stamina-panel__btn--active': manualStaminaStars === -1 }"
          type="button"
          @click="applyManualStamina(-1)"
        >
          −1 昨晚熬夜
        </button>
        <button
          class="btn btn--ghost btn--small"
          :class="{ 'stamina-panel__btn--active': manualStaminaStars === 0 }"
          type="button"
          @click="applyManualStamina(0)"
        >
          不调整
        </button>
      </div>
    </section>

    <section v-if="showMoneyPanel" class="card money-panel">
      <h3 class="money-panel__title">金钱消费</h3>
      <p class="money-panel__hint">
        默认 {{ MONEY_BASE_BALANCE }} 元，每日固定 +{{ MONEY_DAILY_INCREMENT }} 元。今日消费可多次提交，金额累加；无消费请在未记账时确认。
      </p>
      <div class="money-panel__summary">
        <div class="money-panel__stat">
          <span class="money-panel__stat-label">当前余额</span>
          <span class="money-panel__stat-value">{{ formatMoneyAmount(moneySnapshot.walletBalance) }}</span>
        </div>
        <div class="money-panel__stat">
          <span class="money-panel__stat-label">今日累计消费</span>
          <span class="money-panel__stat-value">{{ formatMoneyAmount(todayMoneyTotal) }}</span>
        </div>
      </div>

      <p v-if="moneySpend.noSpendConfirmed" class="money-panel__done">已确认今日无消费</p>

      <ul v-if="moneySpend.entries.length > 0" class="money-panel__entries">
        <li v-for="entry in [...moneySpend.entries].reverse()" :key="entry.id" class="money-panel__entry">
          <span>{{ formatMoneyAmount(entry.amount) }}</span>
          <span class="money-panel__entry-time">{{ formatMoneyEntryTime(entry.submittedAt) }}</span>
        </li>
      </ul>

      <label v-if="!moneySpend.noSpendConfirmed" class="money-panel__check">
        <input v-model="moneyHasSpending" type="checkbox" />
        <span>本次有消费</span>
      </label>

      <div v-if="!moneySpend.noSpendConfirmed && moneyHasSpending" class="money-panel__form">
        <label class="money-panel__field">
          <span class="money-panel__field-label">本次消费金额（元）</span>
          <input
            v-model="moneySpentInput"
            class="money-panel__input"
            type="number"
            min="1"
            step="1"
            inputmode="decimal"
            placeholder="例如 12"
          />
        </label>
      </div>

      <p v-if="moneySubmitError" class="money-panel__error">{{ moneySubmitError }}</p>
      <p v-if="moneySubmitSuccess" class="money-panel__success">{{ moneySubmitSuccess }}</p>

      <button
        v-if="!moneySpend.noSpendConfirmed && moneyHasSpending"
        class="btn btn--primary btn--large money-panel__submit"
        type="button"
        @click="submitMoneySpend"
      >
        提交本次消费
      </button>
      <button
        v-else-if="canConfirmNoSpend && !moneyHasSpending"
        class="btn btn--primary btn--large money-panel__submit"
        type="button"
        @click="submitMoneySpend"
      >
        确认今日无消费
      </button>
    </section>

    <section v-if="showCleanlinessPanel" class="card cleanliness-panel">
      <h3 class="cleanliness-panel__title">洁净力</h3>
      <p class="cleanliness-panel__hint">
        记录今日个人卫生与居住环境打理情况，完成日常清洁 +1 星。
      </p>
      <div class="cleanliness-panel__preview">
        <span class="cleanliness-panel__stars">{{ cleanlinessStarsDisplay }}</span>
        <span class="cleanliness-panel__status">
          {{ cleanlinessMaintained ? '今日已打理' : '今日未标记打理' }}
        </span>
      </div>
      <button
        class="btn btn--ghost btn--large cleanliness-panel__toggle"
        :class="{ 'cleanliness-panel__toggle--active': cleanlinessMaintained }"
        type="button"
        @click="toggleCleanlinessMaintained"
      >
        {{ cleanlinessMaintained ? '取消今日打理标记' : '标记今日已完成清洁卫生打理' }}
      </button>
    </section>

    <section v-if="displayState.status === 'ready'" class="card daily-stars">
      <div class="daily-stars__header">
        <p class="daily-stars__subtitle">{{ headerSubtitle }}</p>
        <span class="daily-stars__total-label">{{ breakdown!.totalStars }} 星</span>
      </div>
      <p
        class="daily-stars__score"
        :class="{ 'daily-stars__score--negative': breakdown!.totalStars < 0 }"
      >
        {{ totalStarsDisplay }}
      </p>

      <div class="daily-stars__breakdown">
        <p class="daily-stars__group-title">劳动</p>
        <div class="daily-stars__row">
          <span class="daily-stars__row-label">时长</span>
          <span class="daily-stars__row-stars">{{ laborStarsDisplay }}</span>
          <span class="daily-stars__row-meta">{{ laborTotalDisplay }}</span>
        </div>
        <p class="daily-stars__rule">累计 &gt;30 分钟 +1 星，&gt;90 分钟再 +1 星</p>

        <p class="daily-stars__group-title">锻炼（大卡）</p>
        <div class="daily-stars__row">
          <span class="daily-stars__row-label">消耗</span>
          <span
            class="daily-stars__row-stars"
            :class="{ 'daily-stars__row-stars--penalty': breakdown!.exerciseStars < 0 }"
          >
            {{ exerciseStarsDisplay }}
          </span>
          <span class="daily-stars__row-meta">{{ exerciseCaloriesDisplay }}</span>
        </div>
        <p class="daily-stars__rule">
          大卡 ≥100 +1 星，≥180 +2 星；低于 100 扣 1 星
        </p>

        <p class="daily-stars__group-title">毅力</p>
        <div class="daily-stars__row daily-stars__row--perseverance">
          <span class="daily-stars__row-label">合计</span>
          <span
            class="daily-stars__row-stars"
            :class="{ 'daily-stars__row-stars--penalty': breakdown!.perseveranceStars < 0 }"
          >
            {{ perseveranceStarsDisplay }}
          </span>
          <span class="daily-stars__row-meta">{{ perseveranceMetaDisplay }}</span>
        </div>
        <p class="daily-stars__rule">
          运动 ≥30 分钟且学习 ≥6 小时 +1 星，任一项未达标 −1 星
        </p>

        <p class="daily-stars__group-title">体力</p>
        <div class="daily-stars__row daily-stars__row--perseverance">
          <span class="daily-stars__row-label">合计</span>
          <span
            class="daily-stars__row-stars"
            :class="{ 'daily-stars__row-stars--penalty': breakdown!.staminaStars < 0 }"
          >
            {{ staminaStarsDisplay }}
          </span>
          <span class="daily-stars__row-meta">{{ staminaMetaDisplay }}</span>
        </div>
        <p class="daily-stars__rule">
          大卡 ≥100 自动 +1 星；可手动 +1（休息良好）或 −1（昨晚熬夜）
        </p>

        <p class="daily-stars__group-title">金钱消费</p>
        <div class="daily-stars__row daily-stars__row--perseverance">
          <span class="daily-stars__row-label">记录</span>
          <span class="daily-stars__row-stars money-row__value">
            {{ breakdown!.moneyHasSpending ? formatMoneyAmount(breakdown!.moneySpent) : '无消费' }}
          </span>
          <span class="daily-stars__row-meta">{{ moneyMetaDisplay }}</span>
        </div>
        <p class="daily-stars__rule">
          默认 {{ MONEY_BASE_BALANCE }} 元，每日 +{{ MONEY_DAILY_INCREMENT }} 元；有消费需当日提交
        </p>

        <p class="daily-stars__group-title">洁净力</p>
        <div class="daily-stars__row">
          <span class="daily-stars__row-label">打理</span>
          <span class="daily-stars__row-stars">{{ formatStarCount(breakdown!.cleanlinessStars, 1) }}</span>
          <span class="daily-stars__row-meta">
            {{ breakdown!.cleanlinessMaintained ? '已完成清洁卫生' : '未标记打理' }}
          </span>
        </div>
        <p class="daily-stars__rule">每日完成清洁卫生打理 +1 星</p>
      </div>
    </section>

    <section class="card tip-card">
      <h3 class="tip-card__title">说明</h3>
      <ul class="tip-card__list">
        <li>自 6 月 30 日起统计，6 月 29 日不计入星级</li>
        <li>当天进行中的数据不会实时计星，须等 24:00 结束后于次日查看</li>
        <li>体力手动调整、金钱消费记录可在当日结算前填写，与日终数据一并归档</li>
        <li>金钱：初始 {{ MONEY_BASE_BALANCE }} 元，每日 +{{ MONEY_DAILY_INCREMENT }} 元；有消费须提交</li>
        <li>洁净力：标记当日完成清洁卫生打理 +1 星</li>
        <li>劳动 0～2 星，锻炼大卡 −1～2 星，毅力 −1～1 星，体力 −1～2 星，洁净力 0～1 星</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.stars-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  width: 100%;
}

@media (min-width: 768px) {
  .stars-page {
    max-width: 640px;
    margin: 0 auto;
  }
}

.pending-card {
  padding: 24px 20px;
  text-align: center;
}

.pending-card__title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
}

.pending-card__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.stamina-panel {
  padding: 18px 16px;
}

.stamina-panel__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.stamina-panel__hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.stamina-panel__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-bottom: 14px;
  padding: 14px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.stamina-panel__preview-label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.stamina-panel__preview-stars {
  font-size: 28px;
  letter-spacing: 3px;
  color: #f9a825;
}

.stamina-panel__preview-meta {
  font-size: 12px;
  color: var(--color-text-secondary);
  text-align: center;
}

.stamina-panel__actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

@media (min-width: 480px) {
  .stamina-panel__actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.stamina-panel__btn--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.money-panel {
  padding: 18px 16px;
}

.money-panel__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.money-panel__hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.money-panel__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.money-panel__stat {
  padding: 12px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  text-align: center;
}

.money-panel__stat-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.money-panel__stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.money-panel__check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
}

.money-panel__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.money-panel__field-label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.money-panel__input {
  width: 100%;
  padding: 12px 14px;
  font-size: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
}

.money-panel__error {
  margin: 0 0 10px;
  font-size: 12px;
  color: #c62828;
}

.money-panel__done {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--color-primary);
  text-align: center;
}

.money-panel__success {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--color-primary);
  text-align: center;
}

.money-panel__entries {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.money-panel__entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--color-bg);
  border-radius: 8px;
  font-size: 13px;
}

.money-panel__entry-time {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.money-panel__submit {
  width: 100%;
}

.cleanliness-panel {
  padding: 18px 16px;
}

.cleanliness-panel__title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
}

.cleanliness-panel__hint {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.cleanliness-panel__preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  padding: 14px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.cleanliness-panel__stars {
  font-size: 28px;
  letter-spacing: 3px;
  color: #f9a825;
}

.cleanliness-panel__status {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.cleanliness-panel__toggle {
  width: 100%;
}

.cleanliness-panel__toggle--active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.money-row__value {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
}

.daily-stars {
  padding: 24px 20px;
  background: linear-gradient(135deg, rgba(255, 193, 7, 0.08), rgba(255, 152, 0, 0.04));
  border: 1px solid rgba(255, 193, 7, 0.25);
}

.daily-stars__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.daily-stars__subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.daily-stars__total-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.daily-stars__score {
  margin: 0 0 20px;
  font-size: 42px;
  letter-spacing: 4px;
  color: #f9a825;
  text-align: center;
}

.daily-stars__score--negative {
  color: #c62828;
}

.daily-stars__breakdown {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.daily-stars__group-title {
  margin: 12px 0 4px;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.daily-stars__group-title:first-child {
  margin-top: 0;
}

.daily-stars__row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.daily-stars__row-label {
  font-size: 14px;
  font-weight: 600;
}

.daily-stars__row-stars {
  font-size: 20px;
  letter-spacing: 2px;
  color: #f9a825;
}

.daily-stars__row-stars--penalty {
  color: #c62828;
}

.daily-stars__row-meta {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: right;
}

.daily-stars__row--perseverance .daily-stars__row-meta {
  font-size: 11px;
  line-height: 1.4;
  max-width: 160px;
}

.daily-stars__rule {
  margin: 0 0 8px;
  padding: 0 12px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.5;
}

.tip-card {
  padding: 16px;
}

.tip-card__title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.tip-card__list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}
</style>
