import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer $CRON_SECRET` を検証する。CRON_SECRET 未設定時は常に拒否する */
export function hasCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
