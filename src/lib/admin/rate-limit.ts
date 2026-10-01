/** ログインの総当たり対策。失敗が続いた接続元を一定時間止める（サーバー 1 台の前提でメモリに持つ） */

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const failures = new Map<string, { count: number; lockedUntil: number }>();

export function isLocked(key: string, now = Date.now()): boolean {
  const f = failures.get(key);
  return Boolean(f && f.lockedUntil > now);
}

export function recordFailure(key: string, now = Date.now()) {
  const f = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILURES) {
    f.lockedUntil = now + LOCK_MS;
    f.count = 0;
  }
  failures.set(key, f);
  if (failures.size > 1000) failures.delete(failures.keys().next().value!);
}

export function recordSuccess(key: string) {
  failures.delete(key);
}
