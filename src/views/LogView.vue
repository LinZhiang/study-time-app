<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import type { DayLog } from '../types/log'
import { LABOR_CATEGORY_LABELS } from '../types/labor'
import { PERIOD_LABELS } from '../types/schedule'
import {
  formatDuration,
  formatEntryTimeRange,
  formatLogDate,
  getDayLogDisplaySnapshot,
  getLoggingStartDateLabel,
  loadActivityLogs,
  shouldLogToday,
} from '../utils/activityLog'
import { formatStarCount, formatStudyDuration } from '../utils/dailyStars'
import { formatExerciseCalories } from '../utils/exerciseRecord'
import { formatLaborDuration } from '../utils/laborRecord'
import { formatMoneyAmount } from '../utils/moneySpendRecord'

const logs = ref(loadActivityLogs())
const expandedDates = ref<string[]>([])

const loggingStartDate = getLoggingStartDateLabel()
const isLoggingToday = shouldLogToday()

function refreshLogs() {
  logs.value = loadActivityLogs()
}

function toggleDate(date: string) {
  if (expandedDates.value.includes(date)) {
    expandedDates.value = expandedDates.value.filter((item) => item !== date)
  } else {
    expandedDates.value = [...expandedDates.value, date]
  }
}

function isExpanded(date: string) {
  return expandedDates.value.includes(date)
}

function periodLabel(period?: keyof typeof PERIOD_LABELS) {
  if (!period) return ''
  return PERIOD_LABELS[period]
}

function getSnapshot(day: DayLog) {
  return getDayLogDisplaySnapshot(day)
}

function sortedEntries(day: DayLog) {
  return [...day.entries].sort((a, b) => a.timestamp - b.timestamp)
}

function studyRecordChanges(day: DayLog) {
  return sortedEntries(day).filter((entry) => entry.type === 'study_record_change')
}

const emptyHint = computed(() => {
  if (isLoggingToday) return '暂无历史日志，今天的记录会在执行后自动保存'
  return `今日暂不记录，${formatLogDate(loggingStartDate)} 起自动记录每日执行情况`
})

onActivated(refreshLogs)
refreshLogs()
</script>

<template>
  <div class="page log-page">
    <section class="card log-notice">
      <p class="log-notice__title">日志说明</p>
      <p class="log-notice__text">
        从 {{ formatLogDate(loggingStartDate) }} 起，系统会完整记录每日番茄、各阶段时长、劳动锻炼、学习进度变更、打分与全部事件；默认只显示摘要，点击展开查看详情。
      </p>
    </section>

    <section v-if="logs.length === 0" class="card log-empty">
      <p>{{ emptyHint }}</p>
    </section>

    <section v-for="day in logs" :key="day.date" class="card day-log">
      <button class="day-log__header" type="button" @click="toggleDate(day.date)">
        <div class="day-log__title-wrap">
          <h2 class="day-log__title">{{ formatLogDate(day.date) }}</h2>
          <p class="day-log__meta">
            {{ day.summary.firstEventTime ?? '--:--:--' }}
            -
            {{ day.summary.lastEventTime ?? '--:--:--' }}
          </p>
        </div>
        <div class="day-log__stats">
          <span class="day-log__stat">番茄 {{ day.summary.totalPomodoros }}</span>
          <span class="day-log__stat">学习 {{ formatDuration(day.summary.studySeconds) }}</span>
          <span class="day-log__stat">劳动 {{ formatDuration(day.summary.laborSeconds) }}</span>
          <span class="day-log__stat">锻炼 {{ formatDuration(day.summary.exerciseSeconds) }}</span>
          <span class="day-log__arrow" :class="{ 'day-log__arrow--open': isExpanded(day.date) }">›</span>
        </div>
      </button>

      <div v-if="isExpanded(day.date)" class="day-log__body">
        <div class="detail-section">
          <h3 class="detail-section__title">各阶段番茄</h3>
          <div class="day-log__summary-grid">
            <div class="summary-item">
              <span class="summary-item__value">{{ getSnapshot(day).schedule.morningPomodoros }}</span>
              <span class="summary-item__label">早上</span>
            </div>
            <div class="summary-item">
              <span class="summary-item__value">{{ getSnapshot(day).schedule.afternoonPomodoros }}</span>
              <span class="summary-item__label">下午</span>
            </div>
            <div class="summary-item">
              <span class="summary-item__value">{{ getSnapshot(day).schedule.eveningPomodoros }}</span>
              <span class="summary-item__label">晚上</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h3 class="detail-section__title">时长与活动</h3>
          <ul class="detail-list">
            <li class="detail-list__item">
              <span class="detail-list__label">学习时长</span>
              <span class="detail-list__value">{{ formatStudyDuration(getSnapshot(day).schedule.studySeconds) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">劳动力合计</span>
              <span class="detail-list__value">{{ formatLaborDuration(getSnapshot(day).laborSeconds) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">锻炼合计</span>
              <span class="detail-list__value">{{ formatLaborDuration(getSnapshot(day).exerciseSeconds) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">锻炼大卡</span>
              <span class="detail-list__value">{{ formatExerciseCalories(getSnapshot(day).exerciseCalories) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">中途休整</span>
              <span class="detail-list__value">{{ formatDuration(getSnapshot(day).schedule.midBreakUsedSeconds) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="getSnapshot(day).stars" class="detail-section">
          <h3 class="detail-section__title">
            日常星级 · 合计 {{ getSnapshot(day).stars!.totalStars }} 星
          </h3>
          <ul class="detail-list">
            <li class="detail-list__item">
              <span class="detail-list__label">劳动</span>
              <span class="detail-list__value">{{ formatStarCount(getSnapshot(day).stars!.laborStars) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">锻炼大卡</span>
              <span class="detail-list__value">{{ formatStarCount(getSnapshot(day).stars!.exerciseStars, 2) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">毅力</span>
              <span class="detail-list__value">{{ formatStarCount(getSnapshot(day).stars!.perseveranceStars, 1) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">体力</span>
              <span class="detail-list__value">{{ formatStarCount(getSnapshot(day).stars!.staminaStars, 2) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">洁净力</span>
              <span class="detail-list__value">{{ formatStarCount(getSnapshot(day).stars!.cleanlinessStars, 1) }}</span>
            </li>
            <li class="detail-list__item">
              <span class="detail-list__label">金钱消费</span>
              <span class="detail-list__value">
                {{
                  getSnapshot(day).stars!.moneySubmitted
                    ? getSnapshot(day).stars!.moneyHasSpending
                      ? `消费 ${formatMoneyAmount(getSnapshot(day).stars!.moneySpent)}`
                      : '无消费'
                    : '未提交'
                }}
              </span>
            </li>
          </ul>
        </div>

        <div v-if="getSnapshot(day).laborEntries.length > 0" class="detail-section">
          <h3 class="detail-section__title">劳动力明细</h3>
          <ul class="entry-list">
            <li
              v-for="entry in getSnapshot(day).laborEntries"
              :key="entry.id"
              class="entry-item entry-item--compact"
            >
              <div class="entry-item__content">
                <span class="entry-item__label">{{ LABOR_CATEGORY_LABELS[entry.category] }}</span>
                <span class="entry-item__meta">
                  {{ periodLabel(entry.period) }} · {{ formatLaborDuration(entry.durationSeconds) }}
                </span>
                <span class="entry-item__meta">{{ formatEntryTimeRange(entry.startedAt, entry.endedAt) }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="getSnapshot(day).exerciseEntries.length > 0" class="detail-section">
          <h3 class="detail-section__title">锻炼明细</h3>
          <ul class="entry-list">
            <li
              v-for="entry in getSnapshot(day).exerciseEntries"
              :key="entry.id"
              class="entry-item entry-item--compact"
            >
              <div class="entry-item__content">
                <span class="entry-item__label">{{ formatExerciseCalories(entry.calories) }}</span>
                <span class="entry-item__meta">
                  {{ periodLabel(entry.period) }} · {{ formatLaborDuration(entry.durationSeconds) }}
                </span>
                <span class="entry-item__meta">{{ formatEntryTimeRange(entry.startedAt, entry.endedAt) }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="studyRecordChanges(day).length > 0" class="detail-section">
          <h3 class="detail-section__title">学习记录变更（{{ studyRecordChanges(day).length }} 项）</h3>
          <ul class="entry-list">
            <li
              v-for="entry in studyRecordChanges(day)"
              :key="entry.id"
              class="entry-item entry-item--compact"
            >
              <span class="entry-item__time">{{ entry.time }}</span>
              <div class="entry-item__content">
                <span class="entry-item__label">{{ entry.label }}</span>
              </div>
            </li>
          </ul>
        </div>

        <div class="detail-section">
          <h3 class="detail-section__title">完整事件记录（{{ sortedEntries(day).length }} 条）</h3>
          <ul class="entry-list">
            <li v-for="entry in sortedEntries(day)" :key="entry.id" class="entry-item">
              <span class="entry-item__time">{{ entry.time }}</span>
              <div class="entry-item__content">
                <span class="entry-item__label">{{ entry.label }}</span>
                <span v-if="entry.period" class="entry-item__tag">{{ periodLabel(entry.period) }}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.log-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.log-notice {
  padding: 16px 18px;
}

.log-notice__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
}

.log-notice__text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.log-empty {
  padding: 28px 18px;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.day-log {
  overflow: hidden;
}

.day-log__header {
  width: 100%;
  border: none;
  background: transparent;
  padding: 16px 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.day-log__title-wrap {
  min-width: 0;
  flex: 1;
}

.day-log__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.day-log__meta {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.day-log__stats {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  max-width: 58%;
  flex-shrink: 0;
}

.day-log__stat {
  font-size: 10px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 4px 7px;
  border-radius: 999px;
  white-space: nowrap;
}

.day-log__arrow {
  font-size: 20px;
  color: var(--color-text-secondary);
  transition: transform 0.2s ease;
  margin-left: 2px;
}

.day-log__arrow--open {
  transform: rotate(90deg);
}

.day-log__body {
  border-top: 1px solid var(--color-border);
  padding: 0 18px 16px;
}

.detail-section {
  padding-top: 14px;
}

.detail-section + .detail-section {
  border-top: 1px solid var(--color-border);
  margin-top: 4px;
}

.detail-section__title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.day-log__summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  background: var(--color-bg);
  border-radius: 10px;
}

.summary-item__value {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.summary-item__label {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--color-bg);
  border-radius: 10px;
}

.detail-list__label {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.detail-list__value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  text-align: right;
}

.entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.entry-item {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-bg);
  border-radius: 12px;
}

.entry-item--compact {
  padding: 10px 12px;
}

.entry-item__time {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
  flex-shrink: 0;
  padding-top: 1px;
}

.entry-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.entry-item__label {
  font-size: 14px;
  line-height: 1.4;
}

.entry-item__meta {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.entry-item__tag {
  align-self: flex-start;
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 999px;
}
</style>
