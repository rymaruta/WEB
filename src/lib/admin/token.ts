import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** 管理画面のログインに使う署名付きトークンとパスワード照合。Next.js に依存しない */

export const SESSION_COOKIE = "zn_admin";
export const SESSION_DAYS = 14;

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
