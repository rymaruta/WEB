import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer $CRON_SECRET` を検証する。CRON_SECRET 未設定時は常に拒否する */
export function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** 管理用 API の認証: CRON_SECRET の Bearer か、管理画面にログイン済みの Cookie */
export async function hasAdminAccess(request: Request): Promise<boolean> {
  if (hasCronSecret(request)) return true;
  const { SESSION_COOKIE, verifyToken } = await import("./admin/token");
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie
    .split(";")
    .map((c) => c.trim().split("="))
    .find(([k]) => k === SESSION_COOKIE)?.[1];
  return verifyToken(token);
}
