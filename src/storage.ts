import type { AccountInfo, Lesson } from "./types";

export interface SavedLesson extends Lesson {
  id: string;
  createdAt: string | number;
  version?: number;
  sizeBytes?: number;
}

const KEY = "ai-learning-lessons-v1";
/* Bản sao dữ liệu cloud để lần tải sau hiện ngay, không phải chờ 1-2s gọi API. */
const CLOUD_KEY = "ai-learning-cloud-cache-v1";

export function loadCloudCache(): { account: AccountInfo | null; lessons: SavedLesson[] } | null {
  try {
    const raw = localStorage.getItem(CLOUD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      account: parsed.account ?? null,
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
    };
  } catch {
    return null;
  }
}

export function saveCloudCache(account: AccountInfo | null, lessons: SavedLesson[]) {
  try {
    localStorage.setItem(CLOUD_KEY, JSON.stringify({ account, lessons }));
  } catch {
    // ignore quota errors
  }
}

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
