import { siteConfig } from "@/config/site";
import { CALENDAR_CATEGORIES, CALENDAR_LABELS, getCalendar, isCalendarCategory, toIcs } from "@/lib/calendar";

export const revalidate = 3600;

/**
 * ぜんぶカレンダーを、スマホやパソコンのカレンダーに読み込める形式（iCalendar）で返す。
 * ?c=game,anime のように分野を絞れる。カレンダーのアプリが定期的に読み直すので、予定は自動で増える
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("c");
  const picked = raw ? raw.split(",").filter(isCalendarCategory) : [];
  const cats = picked.length ? picked : [...CALENDAR_CATEGORIES];
  const { items } = await getCalendar(new Date(), 90);
  const name = cats.length === CALENDAR_CATEGORIES.length ? "ぜんぶカレンダー" : `ぜんぶカレンダー（${cats.map((c) => CALENDAR_LABELS[c]).join("・")}）`;
  const body = toIcs(
    items.filter((it) => cats.includes(it.category)),
    siteConfig.url,
    name,
  );
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="zenbu-calendar.ics"',
      "cache-control": "public, max-age=3600",
    },
  });
}
