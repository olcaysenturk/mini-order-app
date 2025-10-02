// lib/storage.ts
'use client'

import type { Category } from '../types/types'

const KEY = 'categories_v1'

export function loadCategories(): Category[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCategories(data: Category[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(data))
}
