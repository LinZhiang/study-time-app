<script setup lang="ts">
import { computed, onActivated, ref } from 'vue'
import type { StudyMajorCategory } from '../types/studyRecord'
import { logStudyRecordChange } from '../utils/activityLog'
import {
  addMajorCategory,
  addSubCategory,
  adjustSubCategoryStars,
  countStudyRecordStats,
  deleteMajorCategory,
  deleteSubCategory,
  loadStudyRecord,
  saveStudyRecord,
  STUDY_STARS_MAX,
  updateMajorCategory,
  updateSubCategory,
} from '../utils/studyRecord'

const record = ref(loadStudyRecord())
const collapsedMajorIds = ref<Set<string>>(new Set())

const newMajorName = ref('')
const newSubNames = ref<Record<string, string>>({})

const editingMajorId = ref<string | null>(null)
const editingMajorName = ref('')
const editingSubKey = ref<string | null>(null)
const editingSubName = ref('')

const stats = computed(() => countStudyRecordStats(record.value))

function refresh() {
  record.value = loadStudyRecord()
}

function persist(next = record.value) {
  record.value = next
  saveStudyRecord(next)
}

function subEditKey(majorId: string, subId: string) {
  return `${majorId}:${subId}`
}

function isMajorCollapsed(majorId: string) {
  return collapsedMajorIds.value.has(majorId)
}

function toggleMajorCollapse(majorId: string) {
  const next = new Set(collapsedMajorIds.value)
  if (next.has(majorId)) next.delete(majorId)
  else next.add(majorId)
  collapsedMajorIds.value = next
}

function majorSubTotal(category: StudyMajorCategory) {
  return category.subCategories.reduce((sum, item) => sum + item.stars, 0)
}

function findMajor(majorId: string) {
  return record.value.categories.find((item) => item.id === majorId)
}

function findSub(majorId: string, subId: string) {
  return findMajor(majorId)?.subCategories.find((item) => item.id === subId)
}

function handleAddMajor() {
  const name = newMajorName.value.trim()
  if (!name) return
  persist(addMajorCategory(record.value, name))
  logStudyRecordChange({ action: 'major_add', majorName: name })
  newMajorName.value = ''
}

function startEditMajor(category: StudyMajorCategory) {
  editingMajorId.value = category.id
  editingMajorName.value = category.name
}

function cancelEditMajor() {
  editingMajorId.value = null
  editingMajorName.value = ''
}

function submitEditMajor() {
  if (!editingMajorId.value) return
  const major = findMajor(editingMajorId.value)
  const nameAfter = editingMajorName.value.trim()
  if (!major || !nameAfter || nameAfter === major.name) {
    cancelEditMajor()
    return
  }
  const nameBefore = major.name
  persist(updateMajorCategory(record.value, editingMajorId.value, nameAfter))
  logStudyRecordChange({
    action: 'major_rename',
    majorName: nameAfter,
    nameBefore,
    nameAfter,
  })
  cancelEditMajor()
}

function handleDeleteMajor(category: StudyMajorCategory) {
  if (!confirm(`确定删除大类「${category.name}」及其全部小类吗？`)) return
  logStudyRecordChange({ action: 'major_delete', majorName: category.name })
  persist(deleteMajorCategory(record.value, category.id))
  if (editingMajorId.value === category.id) cancelEditMajor()
}

function handleAddSub(majorId: string) {
  const name = (newSubNames.value[majorId] ?? '').trim()
  const major = findMajor(majorId)
  if (!name || !major) return
  persist(addSubCategory(record.value, majorId, name))
  logStudyRecordChange({ action: 'sub_add', majorName: major.name, subName: name })
  newSubNames.value = { ...newSubNames.value, [majorId]: '' }
}

function startEditSub(majorId: string, subId: string, name: string) {
  editingSubKey.value = subEditKey(majorId, subId)
  editingSubName.value = name
}

function cancelEditSub() {
  editingSubKey.value = null
  editingSubName.value = ''
}

function submitEditSub(majorId: string, subId: string) {
  const major = findMajor(majorId)
  const sub = findSub(majorId, subId)
  const nameAfter = editingSubName.value.trim()
  if (!major || !sub || !nameAfter || nameAfter === sub.name) {
    cancelEditSub()
    return
  }
  const nameBefore = sub.name
  persist(updateSubCategory(record.value, majorId, subId, { name: nameAfter }))
  logStudyRecordChange({
    action: 'sub_rename',
    majorName: major.name,
    nameBefore,
    nameAfter,
  })
  cancelEditSub()
}

function handleDeleteSub(majorId: string, subId: string, name: string) {
  if (!confirm(`确定删除小类「${name}」吗？`)) return
  const major = findMajor(majorId)
  if (major) {
    logStudyRecordChange({ action: 'sub_delete', majorName: major.name, subName: name })
  }
  persist(deleteSubCategory(record.value, majorId, subId))
  if (editingSubKey.value === subEditKey(majorId, subId)) cancelEditSub()
}

const STARS_PER_ROW = 10

function getStarRows(stars: number): number[] {
  if (stars <= 0) return []
  const rows: number[] = []
  let remaining = stars
  while (remaining > 0) {
    rows.push(Math.min(STARS_PER_ROW, remaining))
    remaining -= rows[rows.length - 1]!
  }
  return rows
}

function handleStarDelta(majorId: string, subId: string, delta: number) {
  const major = findMajor(majorId)
  const sub = findSub(majorId, subId)
  if (!major || !sub) return
  const starsBefore = sub.stars
  const starsAfter = Math.max(0, Math.min(STUDY_STARS_MAX, starsBefore + delta))
  if (starsBefore === starsAfter) return
  persist(adjustSubCategoryStars(record.value, majorId, subId, delta))
  logStudyRecordChange({
    action: 'stars_change',
    majorName: major.name,
    subName: sub.name,
    starsBefore,
    starsAfter,
  })
}

onActivated(refresh)
refresh()
</script>

<template>
  <div class="page study-page">
    <section class="card summary-card">
      <p class="summary-card__subtitle">学习进度概览</p>
      <div class="summary-card__stats">
        <div class="summary-card__stat">
          <span class="summary-card__value">{{ stats.majorCount }}</span>
          <span class="summary-card__label">大类</span>
        </div>
        <div class="summary-card__stat">
          <span class="summary-card__value">{{ stats.subCount }}</span>
          <span class="summary-card__label">小类</span>
        </div>
        <div class="summary-card__stat">
          <span class="summary-card__value">{{ stats.totalStars }}</span>
          <span class="summary-card__label">总星</span>
        </div>
      </div>
      <p class="summary-card__hint">± 按钮调整星数，按实际数量显示，每行最多 10 颗星</p>
    </section>

    <section class="card add-major-card">
      <h3 class="add-major-card__title">添加学习大类</h3>
      <div class="add-major-card__row">
        <input
          v-model="newMajorName"
          class="study-input"
          type="text"
          maxlength="30"
          placeholder="输入大类名称，如「职测」"
          @keyup.enter="handleAddMajor"
        />
        <button class="btn btn--primary btn--small" type="button" @click="handleAddMajor">
          添加
        </button>
      </div>
    </section>

    <section
      v-for="category in record.categories"
      :key="category.id"
      class="card major-card"
    >
      <div class="major-card__header">
        <button
          class="major-card__collapse"
          type="button"
          :aria-expanded="!isMajorCollapsed(category.id)"
          @click="toggleMajorCollapse(category.id)"
        >
          <span class="major-card__arrow" :class="{ 'major-card__arrow--open': !isMajorCollapsed(category.id) }">
            ▶
          </span>
        </button>

        <div v-if="editingMajorId === category.id" class="major-card__edit-row">
          <input
            v-model="editingMajorName"
            class="study-input study-input--compact"
            type="text"
            maxlength="30"
            @keyup.enter="submitEditMajor"
          />
          <button class="text-btn" type="button" @click="submitEditMajor">保存</button>
          <button class="text-btn text-btn--muted" type="button" @click="cancelEditMajor">取消</button>
        </div>
        <div v-else class="major-card__title-row">
          <h3 class="major-card__title">{{ category.name }}</h3>
          <span class="major-card__meta">
            {{ category.subCategories.length }} 小类 · {{ majorSubTotal(category) }} 星
          </span>
        </div>

        <div v-if="editingMajorId !== category.id" class="major-card__actions">
          <button
            class="icon-btn"
            type="button"
            aria-label="修改大类"
            @click="startEditMajor(category)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
              />
            </svg>
          </button>
          <button
            class="icon-btn icon-btn--danger"
            type="button"
            aria-label="删除大类"
            @click="handleDeleteMajor(category)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
              />
            </svg>
          </button>
        </div>
      </div>

      <div v-show="!isMajorCollapsed(category.id)" class="major-card__body">
        <ul v-if="category.subCategories.length > 0" class="sub-list">
          <li
            v-for="sub in category.subCategories"
            :key="sub.id"
            class="sub-item"
          >
            <div class="sub-item__info">
              <div v-if="editingSubKey === subEditKey(category.id, sub.id)" class="sub-item__edit-row">
                <input
                  v-model="editingSubName"
                  class="study-input study-input--compact"
                  type="text"
                  maxlength="40"
                  @keyup.enter="submitEditSub(category.id, sub.id)"
                />
                <button class="text-btn" type="button" @click="submitEditSub(category.id, sub.id)">
                  保存
                </button>
                <button class="text-btn text-btn--muted" type="button" @click="cancelEditSub">
                  取消
                </button>
              </div>
              <p v-else class="sub-item__name">{{ sub.name }}</p>
            </div>

            <div class="sub-item__rating">
              <div class="sub-item__star-controls">
                <button
                  class="star-step-btn"
                  type="button"
                  aria-label="减少星数"
                  :disabled="sub.stars <= 0"
                  @click="handleStarDelta(category.id, sub.id, -1)"
                >
                  −
                </button>

                <div class="sub-item__star-main">
                  <p v-if="sub.stars === 0" class="sub-item__star-empty">0 星</p>
                  <div v-else class="sub-item__star-grid">
                    <div
                      v-for="(rowCount, rowIndex) in getStarRows(sub.stars)"
                      :key="rowIndex"
                      class="sub-item__star-row"
                    >
                      <span
                        v-for="n in rowCount"
                        :key="`${rowIndex}-${n}`"
                        class="rating-star rating-star--filled"
                        aria-hidden="true"
                      >
                        ★
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  class="star-step-btn"
                  type="button"
                  aria-label="增加星数"
                  :disabled="sub.stars >= STUDY_STARS_MAX"
                  @click="handleStarDelta(category.id, sub.id, 1)"
                >
                  +
                </button>
              </div>
            </div>

            <div
              v-if="editingSubKey !== subEditKey(category.id, sub.id)"
              class="sub-item__actions"
            >
              <button
                class="icon-btn"
                type="button"
                aria-label="修改小类"
                @click="startEditSub(category.id, sub.id, sub.name)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                  />
                </svg>
              </button>
              <button
                class="icon-btn icon-btn--danger"
                type="button"
                aria-label="删除小类"
                @click="handleDeleteSub(category.id, sub.id, sub.name)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
                  />
                </svg>
              </button>
            </div>
          </li>
        </ul>

        <p v-else class="empty-hint">暂无小类，可在下方添加</p>

        <div class="add-sub-row">
          <input
            v-model="newSubNames[category.id]"
            class="study-input study-input--compact"
            type="text"
            maxlength="40"
            placeholder="新小类名称"
            @keyup.enter="handleAddSub(category.id)"
          />
          <button
            class="btn btn--ghost btn--small"
            type="button"
            @click="handleAddSub(category.id)"
          >
            添加小类
          </button>
        </div>
      </div>
    </section>

    <p v-if="record.categories.length === 0" class="empty-page-hint">
      还没有学习大类，请先添加一个。
    </p>
  </div>
</template>

<style scoped>
.study-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-bottom: 24px;
}

.summary-card {
  padding: 18px 16px;
}

.summary-card__subtitle {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.summary-card__stats {
  display: flex;
  gap: 12px;
}

.summary-card__stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.summary-card__value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary);
}

.summary-card__label {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.summary-card__hint {
  margin: 12px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-tertiary);
}

.add-major-card {
  padding: 16px;
}

.add-major-card__title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 600;
}

.add-major-card__row {
  display: flex;
  gap: 10px;
}

.study-input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 14px;
  background: var(--color-surface);
  color: var(--color-text);
}

.study-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.study-input--compact {
  padding: 8px 10px;
  font-size: 13px;
}

.major-card {
  overflow: hidden;
}

.major-card__header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--color-border);
}

.major-card__collapse {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  margin-top: 2px;
  border: none;
  background: var(--color-bg);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.major-card__arrow {
  display: inline-block;
  font-size: 10px;
  transition: transform 0.15s ease;
}

.major-card__arrow--open {
  transform: rotate(90deg);
}

.major-card__title-row,
.major-card__edit-row {
  flex: 1;
  min-width: 0;
}

.major-card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.major-card__meta {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.major-card__edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.major-card__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.icon-btn:active {
  background: var(--color-border);
}

.icon-btn--danger {
  color: #c45c26;
}

.major-card__body {
  padding: 12px 14px 14px;
}

.sub-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sub-item {
  padding: 12px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.sub-item__info {
  margin-bottom: 10px;
}

.sub-item__name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}

.sub-item__edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sub-item__rating {
  margin-bottom: 8px;
}

.sub-item__star-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.sub-item__star-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.sub-item__star-empty {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.sub-item__star-grid {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 100%;
}

.sub-item__star-row {
  display: flex;
  justify-content: center;
  flex-wrap: nowrap;
  gap: 2px;
  max-width: 100%;
}

.star-step-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-primary);
}

.star-step-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.rating-star {
  font-size: 17px;
  line-height: 1;
  color: #f9a825;
}

.rating-star--filled {
  color: #f9a825;
}

.sub-item__actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.add-sub-row {
  display: flex;
  gap: 10px;
}

.text-btn--muted {
  color: var(--color-text-secondary);
}

.empty-hint,
.empty-page-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
}

.empty-page-hint {
  padding: 24px 0;
}
</style>
