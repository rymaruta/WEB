import { prisma } from "@/lib/db";

/**
 * 今週の10大ニュース。1週間（月曜〜日曜、日本時間）に最初に報じられた出来事を、報じた媒体の多い順に10本並べる。
 * 同じジャンルは3本まで（スポーツや芸能だけで埋まらないように）。文章は各話題のまとめ記事の見出し・リードを使い、新しく書き足さない
 */

const JST = 9 * 3_600_000;
const DAY = 86_400_000;
/** 公開を始めた週 */
const FIRST_WEEK = "2026-W40";
export const WEEKLY_COUNT = 10;
const PER_GENRE = 3;

/** ISO 週（月曜はじまり）の番号。例: 2026-W40 */
export function weekKey(now = new Date()): string {
  const jst = new Date(now.getTime() + JST);
  const day = (jst.getUTCDay() + 6) % 7; // 月曜=0
  const thursday = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  // その週の木曜日が、その年の何日目か（1始まり）から週の番号を出す
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** 週の始まり（月曜 0時、日本時間）と終わり（次の月曜 0時） */
export function weekRange(key: string): { start: Date; end: Date } | null {
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const [year, week] = [Number(m[1]), Number(m[2])];
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = Date.UTC(year, 0, 4) - ((jan4.getUTCDay() + 6) % 7) * DAY + (week - 1) * 7 * DAY;
  const start = new Date(monday - JST);
  // 53週目がない年の W53 などは受け付けない
  if (weekKey(start) !== key) return null;
  return { start, end: new Date(start.getTime() + 7 * DAY) };
}

export function isWeeklyKey(key: string, now = new Date()): boolean {
  return weekRange(key) !== null && key >= FIRST_WEEK && key <= weekKey(now);
}

/** 公開している週（新しい順） */
export function recentWeeks(count: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const k = weekKey(new Date(now.getTime() - i * 7 * DAY));
    if (k < FIRST_WEEK) break;
    out.push(k);
  }
  return out;
}

/** 週の表示（10月5日〜10月11日） */
export function weekLabel(key: string): string {
  const r = weekRange(key);
  if (!r) return key;
  const f = (d: Date) => {
    const j = new Date(d.getTime() + JST);
    return `${j.getUTCMonth() + 1}月${j.getUTCDate()}日`;
  };
  return `${f(r.start)}〜${f(new Date(r.end.getTime() - DAY))}`;
}

export type WeeklyCandidate = { id: number; genreSlug: string; publisherCount: number; score: number };

/** 報じた媒体の多い順（同じなら話題度の順）に、同じジャンルは PER_GENRE 本までで count 本 */
export function pickWeekly<T extends WeeklyCandidate>(candidates: T[], count = WEEKLY_COUNT): T[] {
  const sorted = [...candidates].sort((a, b) => b.publisherCount - a.publisherCount || b.score - a.score || a.id - b.id);
  const perGenre = new Map<string, number>();
  const out: T[] = [];
  for (const c of sorted) {
    if (out.length >= count) break;
    const n = perGenre.get(c.genreSlug) ?? 0;
    if (n >= PER_GENRE) continue;
    perGenre.set(c.genreSlug, n + 1);
    out.push(c);
  }
  return out;
}

export async function getWeekly(key: string) {
  const range = weekRange(key);
  if (!range) return null;
  const topics = await prisma.topic.findMany({
    where: { firstSeenAt: { gte: range.start, lt: range.end }, mergedIntoId: null, aiNotNews: false, publisherCount: { gte: 2 } },
    orderBy: [{ publisherCount: "desc" }, { score: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      aiTitle: true,
      aiLead: true,
      publisherCount: true,
      articleCount: true,
      score: true,
      firstSeenAt: true,
      genre: { select: { slug: true, name: true } },
    },
  });
  const picked = pickWeekly(topics.map((t) => ({ ...t, genreSlug: t.genre.slug })));
  return { key, ...range, items: picked };
}
