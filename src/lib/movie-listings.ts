import { prisma } from "@/lib/db";
import { diffSchedule, recordScheduleChanges } from "@/lib/schedule-changes";

/**
 * 映画の公開予定。Wikipedia「◯年の日本公開映画」（CC BY-SA）から、作品名・公開日・製作国だけを毎日取り込む。
 * 一覧には小さな作品も多いため、Wikipedia に記事がある作品（リンクが赤くないもの）だけを載せる。
 */

export type MovieItem = { title: string; release: string; country: string | null };

const UA = "ZenbuNaviBot/1.0 (+https://zenbu-navi.com/about)";

export const moviePageTitle = (year: number) => `${year}年の日本公開映画`;
export const moviePageUrl = (year: number) => `https://ja.wikipedia.org/wiki/${encodeURIComponent(moviePageTitle(year))}`;

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();

/** 一覧のページ（Wikipedia の HTML）から、月の見出し → 日 → 作品 の順に読む */
export function parseMoviePage(html: string, year: number): MovieItem[] {
  const out: MovieItem[] = [];
  for (let month = 1; month <= 12; month++) {
    const start = html.indexOf(`id="${month}月"`);
    if (start < 0) continue;
    const next = month < 12 ? html.indexOf(`id="${month + 1}月"`, start) : -1;
    const section = html.slice(start, next > 0 ? next : undefined);
    const parts = section.split(/<li[^>]*>\s*(\d{1,2})日\s*<ul/);
    for (let i = 1; i < parts.length; i += 2) {
      const day = Number(parts[i]);
      if (day < 1 || day > 31) continue;
      const release = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      for (const li of parts[i + 1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
        const links = [...li[1].matchAll(/<a rel="mw:WikiLink"([^>]*)>([\s\S]*?)<\/a>/g)];
        if (links.length === 0) continue;
        const [first, ...rest] = links;
        // 記事のない作品（赤いリンク）は載せない
        if (/class="new"/.test(first[1])) continue;
        const title = decode(first[2]);
        if (!title) continue;
        const country = rest.map((l) => decode(l[2])).find((c) => c && !c.startsWith("ファイル")) ?? null;
        out.push({ title, release, country });
      }
    }
  }
  return out;
}

async function fetchYear(year: number): Promise<MovieItem[]> {
  const res = await fetch(moviePageUrl(year), { headers: { "user-agent": UA }, signal: AbortSignal.timeout(30_000) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`wikipedia ${year}: HTTP ${res.status}`);
  return parseMoviePage(await res.text(), year);
}

/** 今年（11月以降は来年も）の一覧を取り込む。一覧から消えたこれからの作品（公開延期など）は消す。取得に失敗したら前回の内容を残す */
export async function syncMovieListings(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3_600_000);
  const today = jst.toISOString().slice(0, 10);
  const year = jst.getUTCFullYear();
  const years = jst.getUTCMonth() + 1 >= 11 ? [year, year + 1] : [year];
  const items = (await Promise.all(years.map(fetchYear))).flat();
  if (items.length === 0) throw new Error("wikipedia: no movies");
  const seen = new Map<string, MovieItem>();
  for (const m of items) seen.set(`${m.title}|${m.release}`, m);
  // 取り込む前のこれからの予定と比べて、日付の変更・一覧から外れた予定を記録する
  const before = await prisma.movieListing.findMany({ where: { release: { gte: today } }, select: { id: true, title: true, release: true } });
  const changed = await recordScheduleChanges(
    "movie",
    diffSchedule(
      before.map((m) => ({ key: m.title, title: m.title, date: m.release })),
      [...seen.values()].map((m) => ({ key: m.title, title: m.title, date: m.release })),
      today,
    ),
    moviePageUrl(years[0]),
    now,
  );
  for (const m of seen.values()) {
    const source = { sourceUrl: moviePageUrl(Number(m.release.slice(0, 4))), checkedAt: now };
    await prisma.movieListing.upsert({
      where: { title_release: { title: m.title, release: m.release } },
      create: { ...m, ...source },
      update: { country: m.country, ...source },
    });
  }
  const gone = before.filter((m) => !seen.has(`${m.title}|${m.release}`)).map((m) => m.id);
  if (gone.length > 0) await prisma.movieListing.deleteMany({ where: { id: { in: gone } } });
  return { fetched: seen.size, removed: gone.length, changed };
}

/** 指定した月（YYYY-MM の配列）に公開される映画（公開日順） */
export async function getMovieSchedule(months: string[]): Promise<MovieItem[]> {
  const rows = await prisma.movieListing.findMany({
    where: { OR: months.map((m) => ({ release: { startsWith: m } })) },
    orderBy: [{ release: "asc" }, { id: "asc" }],
    take: 500,
    select: { title: true, release: true, country: true },
  });
  return rows;
}
