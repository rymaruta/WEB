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

/**
 * 話題を最後に読んだ日時（「前回読んでから何が変わったか」を示すため）。端末にだけ保存し、新しいものから AT_MAX 件。
 * 読んだ記録（zn:read）とは別に持つ（前からある記録の形を変えない）
 */
const KEY_AT = "zn:readAt";
const AT_MAX = 300;
/** この画面を開いてから上書きした話題の、上書き前の日時（開いた瞬間に記録が今に変わるため） */
const previous = new Map<number, number | null>();

function readTimes(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_AT) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function touchReadAt(id: number, now = Date.now()) {
  const times = readTimes();
  if (!previous.has(id)) previous.set(id, typeof times[id] === "number" ? times[id] : null);
  times[id] = now;
  const kept = Object.entries(times)
    .filter(([, t]) => typeof t === "number")
    .sort((a, b) => b[1] - a[1])
    .slice(0, AT_MAX);
  try {
    localStorage.setItem(KEY_AT, JSON.stringify(Object.fromEntries(kept)));
  } catch {}
}

/** 前回この話題を読んだ日時（今回開く前の記録）。記録がなければ null */
export function previousReadAt(id: number): number | null {
  if (previous.has(id)) return previous.get(id)!;
  const t = readTimes()[id];
  return typeof t === "number" ? t : null;
}

export function markRead(id: number) {
  if (!Number.isInteger(id) || id <= 0) return;
  touchReadAt(id);
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
