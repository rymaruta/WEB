"use client";

import { MAX_FOLLOWS, type Follow, type FollowKind } from "./follow-kinds";

/** フォローの一覧（この端末だけに保存）。別のタブで変えた場合も表示をそろえる（storage イベント） */
const KEY = "zn:follows";
const EMPTY: Follow[] = [];
let cache: { raw: string | null; list: Follow[] } | null = null;
const listeners = new Set<() => void>();

function read(): Follow[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (cache && cache.raw === raw) return cache.list;
  let list: Follow[] = EMPTY;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) list = parsed.filter((f): f is Follow => typeof f?.kind === "string" && typeof f?.key === "string" && typeof f?.label === "string");
  } catch {}
  cache = { raw, list };
  return list;
}

function write(list: Follow[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_FOLLOWS)));
  } catch {
    return false;
  }
  listeners.forEach((l) => l());
  return true;
}

export function subscribeFollows(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export const getFollows = read;
export const getFollowsOnServer = () => EMPTY;

export const isFollowing = (kind: FollowKind, key: string) => read().some((f) => f.kind === kind && f.key === key);

/** フォローと解除を切り替える。保存できない環境、または上限に達しているときは false */
export function toggleFollow(f: Follow): boolean {
  const list = read();
  if (isFollowing(f.kind, f.key)) return write(list.filter((x) => !(x.kind === f.kind && x.key === f.key)));
  if (list.length >= MAX_FOLLOWS) return false;
  return write([...list, { kind: f.kind, key: f.key.slice(0, 40), label: f.label.slice(0, 40) }]);
}

export function removeFollow(kind: FollowKind, key: string) {
  write(read().filter((x) => !(x.kind === kind && x.key === key)));
}
