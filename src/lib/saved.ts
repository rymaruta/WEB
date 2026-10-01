"use client";

/**
 * 「あとで読む」に保存した話題。利用者の端末（localStorage）にだけ保存し、サーバーには送らない。
 * 同じ端末の別のタブで保存・削除した場合も表示をそろえる（storage イベント）。
 */
export type SavedTopic = { id: number; title: string; savedAt: number };

const KEY = "zn:saved";
const MAX = 100;
const EMPTY: SavedTopic[] = [];

let cache: { raw: string | null; list: SavedTopic[] } | null = null;
const listeners = new Set<() => void>();

function read(): SavedTopic[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (cache && cache.raw === raw) return cache.list;
  let list: SavedTopic[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      list = parsed.filter((t): t is SavedTopic => Number.isInteger(t?.id) && typeof t?.title === "string" && typeof t?.savedAt === "number");
    }
  } catch {}
  cache = { raw, list };
  return list;
}

function write(list: SavedTopic[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    return false;
  }
  listeners.forEach((l) => l());
  return true;
}

export function subscribeSaved(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getSaved = read;
export const getSavedOnServer = () => EMPTY;

export function isSaved(id: number) {
  return read().some((t) => t.id === id);
}

/** 保存と解除を切り替える。保存できない環境では false */
export function toggleSaved(topic: { id: number; title: string }): boolean {
  const list = read();
  return isSaved(topic.id)
    ? write(list.filter((t) => t.id !== topic.id))
    : write([{ id: topic.id, title: topic.title.slice(0, 120), savedAt: Date.now() }, ...list]);
}

export function removeSaved(id: number) {
  write(read().filter((t) => t.id !== id));
}
