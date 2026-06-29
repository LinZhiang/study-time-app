<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import { PERIOD_LABELS } from '../types/schedule'
import { LABOR_CATEGORY_LABELS } from '../types/labor'
import {
  formatExerciseCalories,
  formatExerciseClock,
  formatExerciseDuration,
  loadTodayExerciseRecord,
} from '../utils/exerciseRecord'
import {
  formatLaborClock,
  formatLaborDuration,
  loadTodayLaborRecord,
} from '../utils/laborRecord'

const laborRecord = ref(loadTodayLaborRecord())
const exerciseRecord = ref(loadTodayExerciseRecord())

function refresh() {
  laborRecord.value = loadTodayLaborRecord()
  exerciseRecord.value = loadTodayExerciseRecord()
}

const laborTotalDisplay = computed(() => formatLaborDuration(laborRecord.value.totalSeconds))
const exerciseTotalDisplay = computed(() =>
  formatExerciseDuration(exerciseRecord.value.totalSeconds),
)
const exerciseCaloriesDisplay = computed(() =>
  formatExerciseCalories(exerciseRecord.value.totalCalories),
)

function formatEntryTime(timestamp: number) {
  const date = new Date(timestamp)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

onActivated(refresh)
refresh()
</script>

<template>
  <div class="page daily-page">
    <section class="summary-row">
      <div class="card summary-card">
        <p class="summary-card__subtitle">今日劳动力合计</p>
        <p class="summary-card__value">{{ laborTotalDisplay }}</p>
        <p class="summary-card__hint">做饭、清洁等额外劳动；次日 0 点清零</p>
      </div>
      <div class="card summary-card summary-card--exercise">
        <p class="summary-card__subtitle">今日锻炼合计</p>
        <p class="summary-card__value">{{ exerciseTotalDisplay }}</p>
        <p class="summary-card__calories">{{ exerciseCaloriesDisplay }}</p>
        <p class="summary-card__hint">自由 1 小时内的锻炼；结束时会记录卡路里；次日 0 点清零</p>
      </div>
    </section>

    <section class="section-block">
      <div class="section-block__header">
        <h2 class="section-block__title">劳动力记录</h2>
        <span class="section-block__meta">{{ laborRecord.entries.length }} 条</span>
      </div>

      <p v-if="laborRecord.entries.length === 0" class="empty-hint">
        暂无记录。在中午用餐/自由时间、晚上休息或自由时间中，点击「进行劳动」开始记录。
      </p>

      <ul v-else class="entry-list">
        <li v-for="entry in laborRecord.entries" :key="entry.id" class="entry-item">
          <div class="entry-item__main">
            <span class="entry-item__category">{{ LABOR_CATEGORY_LABELS[entry.category] }}</span>
            <span class="entry-item__duration">{{ formatLaborClock(entry.durationSeconds) }}</span>
          </div>
          <div class="entry-item__meta">
            <span>{{ PERIOD_LABELS[entry.period] }}</span>
            <span>{{ formatEntryTime(entry.startedAt) }} – {{ formatEntryTime(entry.endedAt) }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section class="section-block">
      <div class="section-block__header">
        <h2 class="section-block__title">锻炼记录</h2>
        <span class="section-block__meta">{{ exerciseRecord.entries.length }} 条</span>
      </div>

      <p v-if="exerciseRecord.entries.length === 0" class="empty-hint">
        暂无记录。在中午或晚上的自由 1 小时内，点击「开始锻炼」，结束后填写卡路里并确认。
      </p>

      <ul v-else class="entry-list">
        <li v-for="entry in exerciseRecord.entries" :key="entry.id" class="entry-item">
          <div class="entry-item__main">
            <span class="entry-item__category">锻炼</span>
            <span class="entry-item__stats">
              <span class="entry-item__duration">{{ formatExerciseClock(entry.durationSeconds) }}</span>
              <span class="entry-item__calories">{{ formatExerciseCalories(entry.calories) }}</span>
            </span>
          </div>
          <div class="entry-item__meta">
            <span>{{ PERIOD_LABELS[entry.period] }}</span>
            <span>{{ formatEntryTime(entry.startedAt) }} – {{ formatEntryTime(entry.endedAt) }}</span>
          </div>
        </li>
      </ul>
    </section>

    <section class="card tip-card">
      <h3 class="tip-card__title">可记录时段</h3>
      <ul class="tip-card__list">
        <li>劳动力：中午用餐/自由 1 小时，晚上自由 1 小时或休息 30 分钟</li>
        <li>锻炼：中午或晚上自由 1 小时内</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.daily-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 24px;
  width: 100%;
}

@media (min-width: 768px) {
  .daily-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .summary-row {
    grid-column: 1 / -1;
  }

  .tip-card {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1024px) {
  .daily-page {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.summary-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 640px) {
  .summary-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.summary-card {
  padding: 20px;
  text-align: center;
}

.summary-card--exercise .summary-card__value {
  color: var(--color-success, #2e7d32);
}

.summary-card__subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.summary-card__value {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 700;
  color: var(--color-primary);
}

.summary-card__calories {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-success, #2e7d32);
}

.summary-card__hint {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
  line-height: 1.5;
}

.section-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-block__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.section-block__meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.empty-hint {
  margin: 0;
  padding: 16px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}

.entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

@media (min-width: 768px) {
  .entry-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}

.entry-item {
  padding: 14px 16px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.entry-item__main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.entry-item__category {
  font-size: 15px;
  font-weight: 600;
}

.entry-item__duration {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-primary);
}

.entry-item__stats {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.entry-item__calories {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-success, #2e7d32);
}

.entry-item__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
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
