import { getAnimeSchedule } from "@/lib/anime";
import { ANIME_KIND_LABELS } from "@/lib/anime-kinds";
import { CHANGE_KIND_LABELS } from "@/lib/change-kinds";
import { getChanges } from "@/lib/changes";
import { getMovieSchedule } from "@/lib/movie-listings";
import { PRODUCT_KIND_LABELS } from "@/lib/product-kinds";
import { getProducts } from "@/lib/products";
import { getGameReleases } from "@/lib/queries";
import { workKey, workPath } from "@/lib/work-keys";

/**
 * ぜんぶカレンダー。ゲームの発売・アニメの放送開始・映画の公開・新商品の発売・暮らしの変更を、
 * 1つのカレンダーにまとめる（分野ごとの一覧はあっても、分野をまたいでそろえたものは少ない）。
 * どれもすでに集めている日付（記事から読み取ったもの・公式ストア・Wikipedia）を使う
 */

export { CALENDAR_CATEGORIES, CALENDAR_COLORS, CALENDAR_LABELS, eventId, isCalendarCategory, type CalendarCategory, type CalendarItem } from "./calendar-kinds";
import { CALENDAR_CATEGORIES, CALENDAR_LABELS, eventId, type CalendarCategory, type CalendarItem } from "./calendar-kinds";

/** 表示する日数（今日から） */
export const CALENDAR_DAYS = 45;

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDate(now = new Date(), addDays = 0): string {
  return new Date(now.getTime() + 9 * 3_600_000 + addDays * 86_400_000).toISOString().slice(0, 10);
}

/** from〜to の月（YYYY-MM）の一覧 */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const end = to.slice(0, 7);
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(key);
    if (key >= end) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** 日まで決まっていて、範囲に入るものだけを日付順に（同じ日は分野の順、同じ分野は元の並び） */
export function sortCalendar(items: CalendarItem[], from: string, to: string): CalendarItem[] {
  const order = new Map(CALENDAR_CATEGORIES.map((c, i) => [c, i]));
  return items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => /^\d{4}-\d{2}-\d{2}$/.test(it.date) && it.date >= from && it.date <= to)
    .sort((a, b) => a.it.date.localeCompare(b.it.date) || order.get(a.it.category)! - order.get(b.it.category)! || a.i - b.i)
    .map(({ it }) => it);
}

export async function getCalendar(now = new Date(), days = CALENDAR_DAYS): Promise<{ from: string; to: string; items: CalendarItem[] }> {
  const from = jstDate(now);
  const to = jstDate(now, days - 1);
  const months = monthsBetween(from, to);
  const topic = (id: number | null) => (id ? `/topic/${id}` : null);
  const [changes, games, anime, movies, products] = await Promise.all([
    getChanges(months),
    getGameReleases(),
    getAnimeSchedule(months),
    getMovieSchedule(months),
    getProducts(from, to),
  ]);
  const items: CalendarItem[] = [
    ...changes.map((c) => ({ date: c.date, category: "changes" as const, title: c.title, note: CHANGE_KIND_LABELS[c.kind] ?? null, href: topic(c.topicId), external: false })),
    ...games.map((g) => ({
      date: g.release,
      category: "game" as const,
      title: g.title,
      note: g.platforms.length ? g.platforms.join("・") : null,
      href: g.workKey ? workPath("game", g.workKey) : (topic(g.topicId) ?? g.storeUrl),
      external: !g.topicId && !!g.storeUrl,
    })),
    ...anime.map((a) => ({
      date: a.date,
      category: (a.kind === "movie" ? "movie" : "anime") as CalendarCategory,
      title: a.title,
      note: [ANIME_KIND_LABELS[a.kind], a.channel].filter(Boolean).join("・") || null,
      href: a.topicId ? workPath("anime", workKey(a.title)) : null,
      external: false,
    })),
    ...movies.map((m) => ({ date: m.release, category: "movie" as const, title: m.title, note: m.country, href: null, external: false })),
    ...products.map((p) => ({
      date: p.date,
      category: "products" as const,
      title: p.name,
      note: [p.maker, PRODUCT_KIND_LABELS[p.kind]].filter(Boolean).join("・") || null,
      href: topic(p.topicId),
      external: false,
    })),
  ];
  // アニメ映画は、映画の一覧とアニメの一覧の両方に出るため、同じ日・同じ題名は1件にする（話題へのリンクがあるほうを残す）
  const seen = new Map<string, CalendarItem>();
  for (const it of items) {
    const key = `${it.date}|${it.category}|${it.title.normalize("NFKC").replace(/\s+/g, "")}`;
    const prev = seen.get(key);
    if (!prev || (!prev.href && it.href)) seen.set(key, it);
  }
  return { from, to, items: sortCalendar([...seen.values()], from, to) };
}

/** iCalendar（.ics）の文字のエスケープ */
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 1行75バイトで折り返す（iCalendar の決まり。続きの行は空白で始める） */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** 同じ予定に毎回同じ ID を付ける（カレンダーのアプリが重複させないように） */
const uid = (it: CalendarItem) => `${eventId(it)}@zenbu-navi.com`;

/**
 * スマホのカレンダーに読み込める形式（終日の予定）。
 * subscribe=false は、選んだ予定を1回だけ取り込む用（読み直しの指定を付けない）
 */
export function toIcs(items: CalendarItem[], siteUrl: string, name: string, now = new Date(), subscribe = true): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const next = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//zenbu-navi//calendar//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(subscribe ? [`X-WR-CALNAME:${icsText(name)}`] : []),
    "X-WR-TIMEZONE:Asia/Tokyo",
    ...(subscribe ? ["REFRESH-INTERVAL;VALUE=DURATION:PT12H"] : []),
    ...items.flatMap((it) => {
      const url = it.href ? (it.external ? it.href : `${siteUrl}${it.href}`) : `${siteUrl}/calendar`;
      return [
        "BEGIN:VEVENT",
        `UID:${uid(it)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${it.date.replace(/-/g, "")}`,
        `DTEND;VALUE=DATE:${next(it.date)}`,
        `SUMMARY:${icsText(`【${CALENDAR_LABELS[it.category]}】${it.title}`)}`,
        ...(it.note ? [`DESCRIPTION:${icsText(it.note)}`] : []),
        `URL:${url}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
      ];
    }),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
