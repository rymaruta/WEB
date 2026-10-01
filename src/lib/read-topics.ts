"use client";

/**
 * 読んだ話題の記録（見出しを薄く表示して、未読が分かるようにする）。
 * 利用者の端末（localStorage）にだけ保存し、サーバーには送らない。古いものから消して最大 MAX 件。
 */
const KEY = "zn:read";
const MAX = 500;
const EMPTY: ReadonlySet<number> = new Set();

let cache: { raw: string | null; set: ReadonlySet<number> } | null = null;
const listeners = new Set<() => void>();

function read(): ReadonlySet<number> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (cache && cache.raw === raw) return cache.set;
  let set: ReadonlySet<number> = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) set = new Set(parsed.filter((n) => Number.isInteger(n)));
  } catch {}
  cache = { raw, set };
  return set;
}

export function markRead(id: number) {
  if (!Number.isInteger(id) || id <= 0) return;
  const current = read();
  if (current.has(id)) return;
  try {
    // 新しいものを後ろに足し、上限を超えたら古いものから落とす
    localStorage.setItem(KEY, JSON.stringify([...current, id].slice(-MAX)));
  } catch {
    return;
  }
  listeners.forEach((l) => l());
}

export function subscribeRead(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getRead = read;
export const getReadOnServer = () => EMPTY;
