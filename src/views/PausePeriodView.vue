<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PausePeriod } from '../types/pausePeriod'
import {
  addPausePeriod,
  countDaysInPeriod,
  formatPausePeriodLabel,
  isTodayPaused,
  listPausePeriods,
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

const todayPaused = computed(() => isTodayPaused())

function refresh() {
  periods.value = listPausePeriods()
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
    <section v-if="todayPaused" class="card pause-page__today card--accent">
      <p class="pause-page__today-title">今天处于休整日</p>
      <p class="pause-page__today-desc">今日不计统计、不播放提醒、不发送通知。</p>
    </section>

    <section class="card pause-page__intro">
      <h2 class="pause-page__section-title">休整日说明</h2>
      <p class="pause-page__intro-text">
        指定某一天或连续几天为休整日。这些日期内系统将暂停番茄统计、日常星级、日志记录、音效提醒与后台通知。
      </p>
    </section>

    <section class="card pause-page__form">
      <h2 class="pause-page__section-title">添加休整日</h2>

      <div class="pause-page__mode">
        <button
          class="btn btn--ghost btn--small"
          :class="{ 'btn--primary': mode === 'single' }"
          type="button"
          @click="mode = 'single'"
        >
          单日
        </button>
        <button
          class="btn btn--ghost btn--small"
          :class="{ 'btn--primary': mode === 'range' }"
          type="button"
          @click="mode = 'range'"
        >
          日期段
        </button>
      </div>

      <div v-if="mode === 'single'" class="pause-page__field">
        <label class="pause-page__label" for="single-date">选择日期</label>
        <input id="single-date" v-model="singleDate" class="pause-page__input" type="date" />
      </div>

      <div v-else class="pause-page__range">
        <div class="pause-page__field">
          <label class="pause-page__label" for="start-date">开始日期</label>
          <input id="start-date" v-model="startDate" class="pause-page__input" type="date" />
        </div>
        <div class="pause-page__field">
          <label class="pause-page__label" for="end-date">结束日期</label>
          <input id="end-date" v-model="endDate" class="pause-page__input" type="date" />
        </div>
      </div>

      <div class="pause-page__field">
        <label class="pause-page__label" for="pause-note">备注（可选）</label>
        <input
          id="pause-note"
          v-model="note"
          class="pause-page__input"
          type="text"
          maxlength="40"
          placeholder="例如：外出旅行"
        />
      </div>

      <p v-if="formError" class="pause-page__error">{{ formError }}</p>

      <button class="btn btn--primary" type="button" @click="submitPeriod">添加</button>
    </section>

    <section class="card pause-page__list">
      <h2 class="pause-page__section-title">已安排的休整日</h2>

      <p v-if="periods.length === 0" class="pause-page__empty">还没有安排休整日。</p>

      <ul v-else class="pause-page__items">
        <li v-for="period in periods" :key="period.id" class="pause-page__item">
          <div class="pause-page__item-main">
            <p class="pause-page__item-title">{{ formatPausePeriodLabel(period) }}</p>
            <p class="pause-page__item-meta">
              共 {{ countDaysInPeriod(period) }} 天
              <span v-if="period.note"> · {{ period.note }}</span>
            </p>
            <p
              v-if="period.startDate <= getTodayKey() && period.endDate >= getTodayKey()"
              class="pause-page__item-active"
            >
              进行中
            </p>
          </div>
          <button
            class="btn btn--ghost btn--small pause-page__delete"
            type="button"
            @click="deletePeriod(period.id)"
          >
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
  gap: 14px;
}

.pause-page__section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.pause-page__today {
  background: #fff7ed;
  border: 1px solid #fed7aa;
}

.pause-page__today-title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: #c45c26;
}

.pause-page__today-desc,
.pause-page__intro-text,
.pause-page__empty {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.pause-page__mode {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.pause-page__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.pause-page__range {
  display: grid;
  gap: 0;
}

.pause-page__label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.pause-page__input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font: inherit;
  background: #fff;
}

.pause-page__error {
  margin: 0 0 12px;
  font-size: 13px;
  color: #c45c26;
}

.pause-page__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pause-page__item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.pause-page__item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.pause-page__item-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}

.pause-page__item-meta {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.pause-page__item-active {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}

.pause-page__delete {
  flex-shrink: 0;
  color: #c45c26;
}
</style>
