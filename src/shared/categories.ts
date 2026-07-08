import type { Category } from './types'

export interface CategoryInfo {
  id: Category
  label: string
  color: string
  /** Counts toward focus time. */
  focus: boolean
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'deep_work', label: 'Deep work', color: '#7c9cf5', focus: true },
  { id: 'research', label: 'Research & learning', color: '#5fb8a5', focus: true },
  { id: 'communication', label: 'Communication', color: '#e6b455', focus: false },
  { id: 'meetings', label: 'Meetings', color: '#c589d9', focus: false },
  { id: 'admin', label: 'Admin & ops', color: '#9aa4b2', focus: false },
  { id: 'break', label: 'Break', color: '#6b7280', focus: false },
  { id: 'distraction', label: 'Distraction', color: '#e0716f', focus: false },
  { id: 'other', label: 'Other', color: '#8a93a6', focus: false }
]

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id)

export function categoryInfo(id: Category): CategoryInfo {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}

export function isValidCategory(value: string): value is Category {
  return (CATEGORY_IDS as string[]).includes(value)
}
