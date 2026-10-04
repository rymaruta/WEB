import { prisma } from "@/lib/db";
import { diffSchedule, recordScheduleChanges } from "@/lib/schedule-changes";

/**
 * テレビアニメの放送開始予定。Wikipedia「日本のテレビアニメ作品一覧（2020年代 後半）」など（CC BY-SA）から、
 * 作品名・放送開始日・主な放送局だけを毎日取り込む。
 * 新しい季節（1・4・7・10月）は数十本が一斉に始まるため、記事から読み取るだけでは一覧が埋まらない
 */

export type AnimeListingItem = { title: string; start: string; channel: string | null };

const UA = "ZenbuNaviBot/1.0 (+https://zenbu-navi.com/about)";

/** その年の作品が載っているページ（10年ごとに前半・後半に分かれている） */
export function animePageTitle(year: number): string {
  const decade = Math.floor(year / 10) * 10;
  return `日本のテレビアニメ作品一覧 (${decade}年代 ${year % 10 < 5 ? "前半" : "後半"})`;
}
export const animePageUrl = (year: number) => `https://ja.wikipedia.org/wiki/${encodeURIComponent(animePageTitle(year).replaceAll(" ", "_"))}`;

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * ページ（Wikipedia の HTML）の「◯年 ◯月 - ◯月」の表から読む。
 * 表の列は 開始日 - 終了日 / 作品名 / 制作会社 / 主放送局・系列 / 話数
 */
export function parseAnimePage(html: string): AnimeListingItem[] {
  const out: AnimeListingItem[] = [];
  const heads = [...html.matchAll(/<h3[^>]*id="(\d{4})年_\d{1,2}月_-_\d{1,2}月"/g)];
  heads.forEach((h, i) => {
    const year = Number(h[1]);
    const section = html.slice(h.index, heads[i + 1]?.index);
    for (const row of section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => decode(c[1]));
      if (cells.length < 4) continue;
      const m = cells[0].match(/^(\d{1,2})月(?:(\d{1,2})日)?/);
      const title = cells[1];
      if (!m || !title) continue;
      const month = Number(m[1]);
      if (month < 1 || month > 12) continue;
      const start = `${year}-${String(month).padStart(2, "0")}${m[2] ? `-${String(Number(m[2])).padStart(2, "0")}` : ""}`;
      out.push({ title, start, channel: cells[3] || null });
    }
  });
  return out;
}

async function fetchYear(year: number): Promise<AnimeListingItem[]> {
  const res = await fetch(animePageUrl(year), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`wikipedia anime ${year}: HTTP ${res.status}`);
  return parseAnimePage(await res.text());
}

/** 今月から3か月先までに始まる作品を取り込む。一覧から消えたこれからの作品（延期など）は消す。取得に失敗したら前回の内容を残す */
export async function syncAnimeListings(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3_600_000);
  const today = jst.toISOString().slice(0, 10);
  const from = today.slice(0, 7);
  const until = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + 3, 1)).toISOString().slice(0, 7);
  // 年の変わり目は、来年の作品が別のページ（10年の前半・後半の境目）に載ることがある。同じページは1回だけ読む
  const byPage = new Map([jst.getUTCFullYear(), Number(until.slice(0, 4))].map((y) => [animePageTitle(y), y]));
  const items = (await Promise.all([...byPage.values()].map(fetchYear))).flat().filter((a) => a.start.slice(0, 7) >= from && a.start.slice(0, 7) <= until);
  if (items.length === 0) throw new Error("wikipedia: no anime");
  const seen = new Map<string, AnimeListingItem>();
  for (const a of items) seen.set(`${a.title}|${a.start}`, a);
  // 取り込む前のこれからの予定と比べて、日付の変更・一覧から外れた予定を記録する
  const before = await prisma.animeListing.findMany({ where: { start: { gte: today } }, select: { id: true, title: true, start: true } });
  const changed = await recordScheduleChanges(
    "anime",
    diffSchedule(
      before.map((a) => ({ key: a.title, title: a.title, date: a.start })),
      [...seen.values()].map((a) => ({ key: a.title, title: a.title, date: a.start })),
      today,
    ),
    animePageUrl(jst.getUTCFullYear()),
    now,
  );
  for (const a of seen.values()) {
    const source = { sourceUrl: animePageUrl(Number(a.start.slice(0, 4))), checkedAt: now };
    await prisma.animeListing.upsert({
      where: { title_start: { title: a.title, start: a.start } },
      create: { ...a, ...source },
      update: { channel: a.channel, ...source },
    });
  }
  const gone = before.filter((a) => !seen.has(`${a.title}|${a.start}`)).map((a) => a.id);
  if (gone.length > 0) await prisma.animeListing.deleteMany({ where: { id: { in: gone } } });
  return { fetched: seen.size, removed: gone.length, changed };
}
