/**
 * フォロー（会社・チーム・国・キーワード）。画面とサーバーの両方で使うので DB に依存しない。
 * フォローの一覧は利用者の端末（localStorage）にだけ保存し、フォロー中のページを開くときにアドレスに入れて送る
 */

export const FOLLOW_KINDS = ["company", "team", "country", "word"] as const;
export type FollowKind = (typeof FOLLOW_KINDS)[number];
export type Follow = { kind: FollowKind; key: string; label: string };

export const FOLLOW_KIND_LABELS: Record<FollowKind, string> = { company: "企業", team: "チーム", country: "国・地域", word: "キーワード" };

/** フォローできる数 */
export const MAX_FOLLOWS = 20;

const isKind = (k: string): k is FollowKind => (FOLLOW_KINDS as readonly string[]).includes(k);

/** アドレスに入れる形（company:トヨタ） */
export const followParam = (f: Pick<Follow, "kind" | "key">) => `${f.kind}:${f.key}`;

/** アドレスから読む。形のおかしいもの・重複は捨てる */
export function parseFollowParams(raw: string | string[] | undefined): Pick<Follow, "kind" | "key">[] {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const seen = new Set<string>();
  const out: Pick<Follow, "kind" | "key">[] = [];
  for (const v of list) {
    const i = v.indexOf(":");
    if (i < 1) continue;
    const kind = v.slice(0, i);
    const key = v.slice(i + 1).trim().slice(0, 40);
    if (!isKind(kind) || !key || seen.has(`${kind}:${key}`)) continue;
    seen.add(`${kind}:${key}`);
    out.push({ kind, key });
    if (out.length >= MAX_FOLLOWS) break;
  }
  return out;
}

/** フォロー中のページのアドレス */
export function followingHref(follows: Pick<Follow, "kind" | "key">[]): string {
  if (follows.length === 0) return "/following";
  const p = new URLSearchParams();
  for (const f of follows) p.append("f", followParam(f));
  return `/following?${p}`;
}
