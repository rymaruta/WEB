import { siteConfig } from "@/config/site";
import { eventId, getCalendar, toIcs } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/** 一度に追加できる予定の数 */
const MAX_EVENTS = 30;

/**
 * 選んだ予定だけを、スマホのカレンダーに取り込める形式で返す（/calendar/add.ics?id=...&id=...）。
 * 中身はサイトの予定の中から ID で探す（送られてきた文字をそのまま載せない）
 */
export async function GET(request: Request) {
  const ids = new Set(new URL(request.url).searchParams.getAll("id").slice(0, MAX_EVENTS));
  if (ids.size === 0) return new Response("予定が選ばれていません", { status: 400 });
  const { items } = await getCalendar(new Date(), 90);
  const picked = items.filter((it) => ids.has(eventId(it)));
  if (picked.length === 0) return new Response("予定が見つかりませんでした", { status: 404 });
  return new Response(toIcs(picked, siteConfig.url, "ぜんぶカレンダー", new Date(), false), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="zenbu-calendar.ics"',
      "cache-control": "private, no-store",
    },
  });
}
