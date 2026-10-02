import { prisma } from "@/lib/db";

/**
 * 日付ごとのニュースまとめ（/daily/2026-10-02）と、ジャンル別の月間まとめ（/archive/2026-10/game）。
 * その日・その月に最初に報じられた出来事を、報じた媒体の多い順に並べる。文章は各話題のまとめ記事の見出し・リードを使い、新しく書き足さない
 */

const JST = 9 * 3_600_000;
const DAY = 86_400_000;
/** 集め始めた日・月（これより前のページは作らない） */
export const FIRST_DAY = "2026-09-30";
export const FIRST_MONTH = "2026-10";
/** 日付ページで、ジャンルごとに並べる本数 */
export const DAILY_PER_GENRE = 5;
/** 日付ページの「その日の主なニュース」の本数 */
export const DAILY_TOP = 5;
/** 月間まとめの本数 */
export const MONTHLY_COUNT = 30;
/** これより少ない日・月のページは、検索エンジンに出さない（中身が薄いため） */
export const MIN_INDEXABLE = 5;

/** 日本時間の日付（YYYY-MM-DD） */
export const jstDay = (d: Date) => new Date(d.getTime() + JST).toISOString().slice(0, 10);
const jstMonthOf = (d: Date) => jstDay(d).slice(0, 7);

/** 日付ページを作れる日か（集め始めた日から今日まで） */
export function isDailyKey(date: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return false;
  if (new Date(Date.parse(`${date}T00:00:00Z`)).toISOString().slice(0, 10) !== date) return false;
  return date >= FIRST_DAY && date <= jstDay(now);
}

/** 月間まとめを作れる月か（集め始めた月から今月まで） */
export function isArchiveMonth(month: string, now = new Date()): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  return month >= FIRST_MONTH && month <= jstMonthOf(now);
}

export function dayRange(date: string): { start: Date; end: Date } {
  const start = new Date(Date.parse(`${date}T00:00:00Z`) - JST);
  return { start, end: new Date(start.getTime() + DAY) };
}

export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1) - JST), end: new Date(Date.UTC(y, m, 1) - JST) };
}

/** 前後の日（YYYY-MM-DD） */
export const shiftDay = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** 最近の日付（新しい順、集め始めた日まで） */
export function recentDays(count: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = shiftDay(jstDay(now), -i);
    if (d < FIRST_DAY) break;
    out.push(d);
  }
  return out;
}

/** 公開している月（新しい順） */
export function archiveMonths(now = new Date()): string[] {
  const out: string[] = [];
  let [y, m] = jstMonthOf(now).split("-").map(Number);
  for (let i = 0; i < 36; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key < FIRST_MONTH) break;
    out.push(key);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}

/** 10月2日（金） */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${"日月火水木金土"[d.getUTCDay()]}）`;
}

/** 2026年10月 */
export const monthLabel = (month: string) => `${Number(month.slice(0, 4))}年${Number(month.slice(5, 7))}月`;

const select = {
  id: true,
  title: true,
  aiTitle: true,
  aiLead: true,
  publisherCount: true,
  articleCount: true,
  score: true,
  firstSeenAt: true,
  genreId: true,
  aiGenreId: true,
} as const;

type Row = { id: number; publisherCount: number; score: number };
const byWeight = (a: Row, b: Row) => b.publisherCount - a.publisherCount || b.score - a.score || a.id - b.id;

/** 日付ページ：その日の主なニュースと、ジャンルごとの上位 */
export async function getDaily(date: string) {
  const { start, end } = dayRange(date);
  const [topics, genres] = await Promise.all([
    prisma.topic.findMany({
      where: { firstSeenAt: { gte: start, lt: end }, mergedIntoId: null, aiNotNews: false, publisherCount: { gte: 2 } },
      orderBy: [{ publisherCount: "desc" }, { score: "desc" }],
      take: 300,
      select,
    }),
    prisma.genre.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const sorted = [...topics].sort(byWeight);
  const genreOf = new Map(genres.map((g) => [g.id, g]));
  const withGenre = sorted.map((t) => ({ ...t, genre: genreOf.get(t.aiGenreId ?? t.genreId)! })).filter((t) => t.genre);
  const top = withGenre.slice(0, DAILY_TOP);
  const topIds = new Set(top.map((t) => t.id));
  const sections = genres
    .map((g) => ({ genre: g, items: withGenre.filter((t) => t.genre.id === g.id && !topIds.has(t.id)).slice(0, DAILY_PER_GENRE) }))
    .filter((s) => s.items.length > 0);
  return { date, total: topics.length, top, sections };
}

/** 月間まとめ：その月にそのジャンルで最初に報じられた出来事の上位 */
export async function getMonthlyGenre(month: string, genreSlug: string) {
  const genre = await prisma.genre.findUnique({ where: { slug: genreSlug } });
  if (!genre) return null;
  const { start, end } = monthRange(month);
  const topics = await prisma.topic.findMany({
    where: {
      firstSeenAt: { gte: start, lt: end },
      mergedIntoId: null,
      aiNotNews: false,
      publisherCount: { gte: 2 },
      OR: [{ aiGenreId: genre.id }, { aiGenreId: null, genreId: genre.id }],
    },
    orderBy: [{ publisherCount: "desc" }, { score: "desc" }],
    take: MONTHLY_COUNT * 2,
    select,
  });
  return { month, genre, items: [...topics].sort(byWeight).slice(0, MONTHLY_COUNT) };
}
