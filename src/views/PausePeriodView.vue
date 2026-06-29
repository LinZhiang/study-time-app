<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { PausePeriod } from '../types/pausePeriod'
import {
  addPausePeriod,
  countDaysInPeriod,
  formatPausePeriodLabel,
  isTodayPaused,
  listPausePeriods,
  PAUSE_PERIODS_UPDATED_EVENT,
  removePausePeriod,
} from '../utils/pausePeriod'
import { getTodayKey } from '../utils/scheduleStorage'

const periods = ref<PausePeriod[]>(listPausePeriods())
const mode = ref<'single' | 'range'>('single')
const singleDate = ref(getTodayKey())
const startDate = ref(getTodayKey())
const endDate = ref(getTodayKey())
const note = ref('')
const formError = ref('')
const pauseTick = ref(0)

const todayPaused = computed(() => {
  void pauseTick.value
  return isTodayPaused()
})

function onPausePeriodsUpdated() {
  pauseTick.value++
  refresh()
}

onMounted(() => {
  window.addEventListener(PAUSE_PERIODS_UPDATED_EVENT, onPausePeriodsUpdated)
})

onUnmounted(() => {
  window.removeEventListener(PAUSE_PERIODS_UPDATED_EVENT, onPausePeriodsUpdated)
})

function refresh() {
  periods.value = listPausePeriods()
}

function isPeriodActive(period: PausePeriod) {
  const today = getTodayKey()
  return period.startDate <= today && period.endDate >= today
}

function submitPeriod() {
  formError.value = ''
  const payload =
    mode.value === 'single'
      ? { startDate: singleDate.value, endDate: singleDate.value, note: note.value }
      : { startDate: startDate.value, endDate: endDate.value, note: note.value }

  if (!payload.startDate || !payload.endDate) {
    formError.value = '请选择日期'
    return
  }

  addPausePeriod(payload)
  note.value = ''
  refresh()
}

function deletePeriod(id: string) {
  if (!confirm('确定删除这条休整日安排吗？')) return
  removePausePeriod(id)
  refresh()
}
</script>

<template>
  <div class="page pause-page">
    <section v-if="todayPaused" class="pause-hero pause-hero--active">
      <div class="pause-hero__icon" aria-hidden="true">⏸</div>
      <div>
        <p class="pause-hero__title">今天处于休整日</p>
        <p class="pause-hero__desc">仅统计番茄轮数与锻炼，不计劳动、星级与其它项</p>
      </div>
    </section>

    <section v-else class="pause-hero card">
      <div class="pause-hero__icon pause-hero__icon--muted" aria-hidden="true">⏸</div>
      <div>
        <p class="pause-hero__title">休整日</p>
        <p class="pause-hero__desc">
          暂停劳动、星级与其它日程统计；休整日仍可使用番茄学习与锻炼记录，分开统计。
        </p>
      </div>
    </section>

    <section class="card pause-form">
      <div class="section-block__header">
        <h2 class="section-block__title">添加安排</h2>
      </div>

      <div class="pause-form__mode" role="tablist" aria-label="休整日类型">
        <button
          class="chip"
          :class="{ 'chip--active': mode === 'single' }"
          type="button"
          role="tab"
          :aria-selected="mode === 'single'"
          @click="mode = 'single'"
        >
          单日
        </button>
        <button
          class="chip"
          :class="{ 'chip--active': mode === 'range' }"
          type="button"
          role="tab"
          :aria-selected="mode === 'range'"
          @click="mode = 'range'"
        >
          日期段
        </button>
      </div>

      <div v-if="mode === 'single'" class="pause-form__field">
        <label class="pause-form__label" for="single-date">选择日期</label>
        <input id="single-date" v-model="singleDate" class="pause-form__input" type="date" />
      </div>

      <div v-else class="pause-form__range">
        <div class="pause-form__field">
          <label class="pause-form__label" for="start-date">开始</label>
          <input id="start-date" v-model="startDate" class="pause-form__input" type="date" />
        </div>
        <span class="pause-form__range-sep">至</span>
        <div class="pause-form__field">
          <label class="pause-form__label" for="end-date">结束</label>
          <input id="end-date" v-model="endDate" class="pause-form__input" type="date" />
        </div>
      </div>

      <div class="pause-form__field">
        <label class="pause-form__label" for="pause-note">备注（可选）</label>
        <input
          id="pause-note"
          v-model="note"
          class="pause-form__input"
          type="text"
          maxlength="40"
          placeholder="例如：外出旅行"
        />
      </div>

      <p v-if="formError" class="pause-form__error">{{ formError }}</p>

      <button class="btn btn--primary btn--large pause-form__submit" type="button" @click="submitPeriod">
        添加休整日
      </button>
    </section>

    <section class="pause-list">
      <div class="section-block__header">
        <h2 class="section-block__title">已安排</h2>
        <span class="section-block__meta">{{ periods.length }} 条</span>
      </div>

      <p v-if="periods.length === 0" class="empty-hint">还没有休整日安排，可在上方添加。</p>

      <ul v-else class="pause-list__items">
        <li
          v-for="period in periods"
          :key="period.id"
          class="card pause-list__item"
          :class="{ 'pause-list__item--active': isPeriodActive(period) }"
        >
          <div class="pause-list__item-body">
            <div class="pause-list__item-head">
              <p class="pause-list__item-title">{{ formatPausePeriodLabel(period) }}</p>
              <span v-if="isPeriodActive(period)" class="pause-list__badge">进行中</span>
            </div>
            <p class="pause-list__item-meta">
              共 {{ countDaysInPeriod(period) }} 天
              <template v-if="period.note"> · {{ period.note }}</template>
            </p>
          </div>
          <button class="text-btn pause-list__delete" type="button" @click="deletePeriod(period.id)">
            删除
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.pause-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
}

.pause-hero {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 20px;
}

.pause-hero--active {
  background: linear-gradient(135deg, #e8f3f0 0%, #f4faf8 100%);
  border: 1px solid #b8ddd4;
  border-radius: var(--radius-lg);
}

.pause-hero__icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  background: var(--color-primary);
  color: #fff;
  font-size: 18px;
  line-height: 1;
}

.pause-hero__icon--muted {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.pause-hero__title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}

.pause-hero__desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.pause-form {
  padding: 20px;
}

.pause-form__mode {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.pause-form__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.pause-form__range {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: end;
  margin-bottom: 4px;
}

.pause-form__range-sep {
  padding-bottom: 12px;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.pause-form__label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.pause-form__input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  font: inherit;
  font-size: 15px;
  color: var(--color-text);
  background: var(--color-bg);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pause-form__input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgb(26 107 92 / 12%);
}

.pause-form__error {
  margin: 0 0 12px;
  font-size: 13px;
  color: #c45c26;
}

.pause-form__submit {
  width: 100%;
  margin-top: 4px;
}

.empty-hint {
  margin: 0;
  padding: 16px 18px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.pause-list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pause-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
}

.pause-list__item--active {
  border-color: #b8ddd4;
  background: linear-gradient(180deg, #fafdfc 0%, #fff 100%);
}

.pause-list__item-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.pause-list__item-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.pause-list__badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 600;
}

.pause-list__item-meta {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.pause-list__delete {
  flex-shrink: 0;
  color: #c45c26;
  font-weight: 500;
}

.pause-list__delete:active {
  opacity: 0.7;
}
</style>
