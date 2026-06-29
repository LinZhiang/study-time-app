import type {
  StudyMajorCategory,
  StudyRecordData,
  StudySubCategory,
} from '../types/studyRecord'
import { STUDY_RECORD_STORAGE_KEY } from '../types/studyRecord'

export const STUDY_STARS_MAX = 99999

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function sub(name: string, stars: number): StudySubCategory {
  return { id: generateId(), name, stars }
}

function major(name: string, items: Array<{ name: string; stars: number }>): StudyMajorCategory {
  return {
    id: generateId(),
    name,
    subCategories: items.map((item) => sub(item.name, item.stars)),
  }
}

export function createDefaultStudyRecord(): StudyRecordData {
  return {
    categories: [
      major('职测', [
        { name: '言语理解与表达', stars: 2 },
        { name: '数量关系', stars: 4 },
        { name: '判断推理', stars: 1 },
        { name: '资料分析', stars: 1 },
      ]),
      major('公基', [
        { name: '政治知识', stars: 5 },
        { name: '经济知识', stars: 0 },
        { name: '法律知识', stars: 1 },
        { name: '历史人文', stars: 2 },
        { name: '科技与生活', stars: 0 },
        { name: '管理与公文', stars: 0 },
      ]),
      major('综应', [
        { name: '概括类试题', stars: 0 },
        { name: '分析类试题', stars: 0 },
        { name: '对策类试题', stars: 0 },
        { name: '公文写作题', stars: 0 },
        { name: '材料写作题', stars: 0 },
        { name: '知识积累', stars: 0 },
      ]),
      major('时政', [
        { name: '2026.4前', stars: 0 },
        { name: '2026.4~2026.9', stars: 0 },
      ]),
      major('计算机基础', [
        { name: '第一部分基础·基础知识', stars: 4 },
        { name: '第一部分基础·信息安全', stars: 2 },
        { name: '第二部分软件·win10', stars: 0 },
        { name: '第二部分软件·word', stars: 0 },
        { name: '第二部分软件·excel', stars: 0 },
        { name: '第二部分软件·ppt', stars: 0 },
        { name: '第三部分理论·关系数据库', stars: 0 },
        { name: '第三部分理论·网络技术基础', stars: 0 },
        { name: '第三部分理论·软件工程', stars: 0 },
        { name: '第三部分理论·C语言程序', stars: 0 },
        { name: '第三部分理论·数据结构', stars: 0 },
        { name: '第三部分理论·操作系统', stars: 0 },
      ]),
      major('面试', [
        { name: '自己项目准备', stars: 0 },
        { name: '以前公司项目准备', stars: 0 },
        { name: '面试准备仪表', stars: 0 },
        { name: '口才', stars: 0 },
        { name: '知识树（零散）', stars: 0 },
        { name: '前端知识', stars: 0 },
        { name: '行业方面', stars: 0 },
      ]),
    ],
  }
}

function normalizeStars(stars: number): number {
  if (!Number.isFinite(stars)) return 0
  return Math.max(0, Math.min(STUDY_STARS_MAX, Math.round(stars)))
}

function normalizeRecord(data: StudyRecordData): StudyRecordData {
  return {
    categories: (data.categories ?? []).map((category) => ({
      id: category.id || generateId(),
      name: String(category.name ?? '').trim() || '未命名大类',
      subCategories: (category.subCategories ?? []).map((item) => ({
        id: item.id || generateId(),
        name: String(item.name ?? '').trim() || '未命名小类',
        stars: normalizeStars(item.stars),
      })),
    })),
  }
}

function saveRecord(data: StudyRecordData) {
  localStorage.setItem(STUDY_RECORD_STORAGE_KEY, JSON.stringify(data))
}

export function loadStudyRecord(): StudyRecordData {
  try {
    const raw = localStorage.getItem(STUDY_RECORD_STORAGE_KEY)
    if (!raw) {
      const defaults = createDefaultStudyRecord()
      saveRecord(defaults)
      return defaults
    }
    return normalizeRecord(JSON.parse(raw) as StudyRecordData)
  } catch {
    const defaults = createDefaultStudyRecord()
    saveRecord(defaults)
    return defaults
  }
}

export function saveStudyRecord(data: StudyRecordData) {
  saveRecord(normalizeRecord(data))
}

export const STUDY_STARS_PER_ROW = 10

export function cloneStudyRecord(data: StudyRecordData): StudyRecordData {
  return JSON.parse(JSON.stringify(data)) as StudyRecordData
}

export function getStudyStarRows(stars: number): number[] {
  if (stars <= 0) return []
  const rows: number[] = []
  let remaining = stars
  while (remaining > 0) {
    rows.push(Math.min(STUDY_STARS_PER_ROW, remaining))
    remaining -= rows[rows.length - 1]!
  }
  return rows
}

export function countStudyRecordStats(data: StudyRecordData) {
  const subCount = data.categories.reduce((sum, category) => sum + category.subCategories.length, 0)
  const totalStars = data.categories.reduce(
    (sum, category) =>
      sum + category.subCategories.reduce((subSum, item) => subSum + item.stars, 0),
    0,
  )
  return {
    majorCount: data.categories.length,
    subCount,
    totalStars,
  }
}

export function addMajorCategory(data: StudyRecordData, name: string): StudyRecordData {
  const trimmed = name.trim()
  if (!trimmed) return data
  return {
    categories: [
      ...data.categories,
      { id: generateId(), name: trimmed, subCategories: [] },
    ],
  }
}

export function updateMajorCategory(
  data: StudyRecordData,
  majorId: string,
  name: string,
): StudyRecordData {
  const trimmed = name.trim()
  if (!trimmed) return data
  return {
    categories: data.categories.map((category) =>
      category.id === majorId ? { ...category, name: trimmed } : category,
    ),
  }
}

export function deleteMajorCategory(data: StudyRecordData, majorId: string): StudyRecordData {
  return {
    categories: data.categories.filter((category) => category.id !== majorId),
  }
}

export function addSubCategory(
  data: StudyRecordData,
  majorId: string,
  name: string,
  stars = 0,
): StudyRecordData {
  const trimmed = name.trim()
  if (!trimmed) return data
  return {
    categories: data.categories.map((category) =>
      category.id === majorId
        ? {
            ...category,
            subCategories: [
              ...category.subCategories,
              { id: generateId(), name: trimmed, stars: normalizeStars(stars) },
            ],
          }
        : category,
    ),
  }
}

export function updateSubCategory(
  data: StudyRecordData,
  majorId: string,
  subId: string,
  patch: { name?: string; stars?: number },
): StudyRecordData {
  return {
    categories: data.categories.map((category) => {
      if (category.id !== majorId) return category
      return {
        ...category,
        subCategories: category.subCategories.map((item) => {
          if (item.id !== subId) return item
          return {
            ...item,
            ...(patch.name !== undefined
              ? { name: patch.name.trim() || item.name }
              : null),
            ...(patch.stars !== undefined ? { stars: normalizeStars(patch.stars) } : null),
          }
        }),
      }
    }),
  }
}

export function deleteSubCategory(
  data: StudyRecordData,
  majorId: string,
  subId: string,
): StudyRecordData {
  return {
    categories: data.categories.map((category) =>
      category.id === majorId
        ? {
            ...category,
            subCategories: category.subCategories.filter((item) => item.id !== subId),
          }
        : category,
    ),
  }
}

export function adjustSubCategoryStars(
  data: StudyRecordData,
  majorId: string,
  subId: string,
  delta: number,
): StudyRecordData {
  const category = data.categories.find((item) => item.id === majorId)
  const sub = category?.subCategories.find((item) => item.id === subId)
  if (!sub) return data
  return updateSubCategory(data, majorId, subId, { stars: sub.stars + delta })
}
