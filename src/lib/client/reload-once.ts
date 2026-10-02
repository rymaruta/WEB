/**
 * 公開の切り替わり直後に、古い画面から新しい版の部品を読み込めずに失敗したときの立て直し。
 * 一度だけページを読み直す（直前に読み直したばかりなら何もしない。読み直しを繰り返さないため）
 */
const KEY = "zn:reloaded-at";
const WINDOW_MS = 30_000;

export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // 保存できない環境では、繰り返しを防げないため自動では読み直さない
    return false;
  }
  window.location.reload();
  return true;
}
