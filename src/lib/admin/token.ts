import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** 管理画面のログインに使う署名付きトークンとパスワード照合。Next.js に依存しない */

export const SESSION_COOKIE = "zn_admin";
/** ログインを保つ日数（運営者1人が自分のスマホで使う前提） */
export const SESSION_DAYS = 60;

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function adminEnabled(): boolean {
  return Boolean(secret() && process.env.ADMIN_PASSWORD);
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/** 署名付きトークン（有効期限入り）を作る */
export function createToken(now = Date.now(), key = secret()): string | null {
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/** トークンの署名と期限を確かめる */
export function verifyToken(token: string | undefined, now = Date.now(), key = secret()): boolean {
  if (!token || !key) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { exp: number };
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}

/** パスワードの照合（長さの違いで時間が変わらないよう、ハッシュ同士を比べる） */
export function passwordMatches(given: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// メールのリンク用の、署名付き・期限つきの鍵（ログインしなくても、その出来事の速報だけを操作できる）
// ---------------------------------------------------------------------------

/** メールのリンクの有効時間 */
export const ACTION_HOURS = 6;

const actionKey = (key: string) => `${key}:breaking-action`;

/** 速報の候補1件を操作するための鍵を作る */
export function createActionToken(storyId: string, now = Date.now(), key = secret()): string | null {
  if (!key || !/^[a-z0-9]{10,40}$/.test(storyId)) return null;
  const payload = Buffer.from(JSON.stringify({ sid: storyId, exp: now + ACTION_HOURS * 3_600_000 })).toString("base64url");
  return `${payload}.${sign(payload, actionKey(key))}`;
}

/** 鍵を確かめ、操作できる出来事の ID を返す（期限切れ・改ざんは null） */
export function verifyActionToken(token: string | undefined, now = Date.now(), key = secret()): string | null {
  if (!token || !key) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, actionKey(key)));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { sid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sid: string; exp: number };
    return typeof exp === "number" && exp > now && typeof sid === "string" && /^[a-z0-9]{10,40}$/.test(sid) ? sid : null;
  } catch {
    return null;
  }
}
