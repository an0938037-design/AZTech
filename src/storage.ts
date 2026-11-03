import type { Lesson } from "./types";

export interface SavedLesson extends Lesson {
  id: string;
  createdAt: string | number;
  version?: number;
  sizeBytes?: number;
}

const KEY = "ai-learning-lessons-v1";

export function loadLessons(): SavedLesson[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLessons(lessons: SavedLesson[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lessons));
  } catch {
    // ignore quota errors
  }
}

export function countLocalLessons(): number {
  return loadLessons().length;
}
