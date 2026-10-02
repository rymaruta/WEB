import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { jstDate } from "@/lib/digest/slots";
import { isBot } from "@/lib/bots";
import { classifyReferrer, normalizePath } from "@/lib/traffic";

export const dynamic = "force-dynamic";

/**
 * 閲覧の記録（ブラウザーから sendBeacon で届く）。日ごとの合計だけを増やし、
 * IP アドレスや端末の情報など、個人を特定できる情報は保存しない
 */
export async function POST(request: Request) {
  if (isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const body = (await request.json().catch(() => null)) as { path?: unknown; ref?: unknown } | null;
  const path = typeof body?.path === "string" ? normalizePath(body.path) : null;
  if (!path) return new Response(null, { status: 204 });
  const host = new URL(siteConfig.url).hostname;
  const source = classifyReferrer(typeof body?.ref === "string" ? body.ref : "", host);
  const date = jstDate(new Date());
  await Promise.all([
    prisma.pageDaily.upsert({ where: { date_path: { date, path } }, create: { date, path, views: 1 }, update: { views: { increment: 1 } } }),
    // サイト内の移動は流入元として数えない
    source
      ? prisma.trafficDaily.upsert({ where: { date_source: { date, source } }, create: { date, source, views: 1 }, update: { views: { increment: 1 } } })
      : null,
  ]).catch(() => null);
  return new Response(null, { status: 204 });
}
