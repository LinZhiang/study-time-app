export const STUDY_RECORD_STORAGE_KEY = 'study-record-categories'

export interface StudySubCategory {
  id: string
  name: string
  stars: number
}

export interface StudyMajorCategory {
  id: string
  name: string
  subCategories: StudySubCategory[]
}

export interface StudyRecordData {
  categories: StudyMajorCategory[]
}
