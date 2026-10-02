import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { publisherLabel } from "@/lib/publisher";
import { verifyDate } from "./game";
import { ANIME_KINDS, type AnimeItem, type AnimeKind } from "./anime-kinds";

export { ANIME_KIND_LABELS, ANIME_KINDS, type AnimeItem, type AnimeKind } from "./anime-kinds";

/**
 * アニメの「放送・配信スケジュール」。アニメ・漫画のページで、今月・来月に始まる放送・配信・劇場公開を月ごとに一覧にする。
 * 「◯月から変わること」と同じく、1. 見出し・要約で候補を絞る → 2. 記事作成の定期処理が読み取る → 3. 資料と照合して保存する
 */

/** 候補を探すジャンル。エンタメはアニメの語がある記事だけ */
const ANIME_GENRES = ["anime", "entertainment"];
const CANDIDATE_DAYS = 30;
const START_RE = /放送|配信|上映|公開/;
const WHEN_RE = /\d{1,2}月(\d{1,2}日)?|\d{1,2}\/\d{1,2}/;
const ANIME_RE = /アニメ|劇場版|TVアニメ|新作アニメ/;
/** 放送・配信の始まりではないもの（見られるサービスの案内、PV・ビジュアルだけの記事など） */
const EXCLUDE_RE = /どこで見れる|見る方法|見る順番|見放題で|一番くじ|グッズ|コラボカフェ|フィギュア/;

export function isAnimeCandidate(text: string, genreSlug: string): boolean {
  const t = text.normalize("NFKC");
  if (genreSlug !== "anime" && !ANIME_RE.test(t)) return false;
  return START_RE.test(t) && WHEN_RE.test(t) && !EXCLUDE_RE.test(t);
}

export const AnimeExtractSchema = z.object({
  isSchedule: z
    .boolean()
    .describe("アニメ作品のテレビ放送・ネット配信・劇場公開が、決まった日（または月）から始まると報じている資料なら true。PV・ビジュアル・キャストの発表だけで始まる日がない記事、グッズ・イベント・見られるサービスの案内は false"),
  anime: z
    .object({
      title: z.string().describe("作品名。資料に書かれている表記のまま（『』や「」は付けない）"),
      date: z.string().describe("始まる日。日まで書かれていれば YYYY-MM-DD、月までなら YYYY-MM。年が書かれていなければ記事の日付から見て次に来るその月の年"),
      kind: z.enum(ANIME_KINDS).describe("tv=テレビ放送、stream=ネット配信（テレビ放送がなく配信だけのもの）、movie=劇場公開、other=それ以外"),
      channel: z.string().nullable().describe("放送局・配信サービス。資料に書かれていれば1つ（例: TOKYO MX、Netflix）。なければ null"),
    })
    .nullable()
    .describe("isSchedule が true のときの情報。false なら null"),
});
export type AnimeExtract = z.infer<typeof AnimeExtractSchema>;

export const ANIME_EXTRACT_SYSTEM = `あなたはアニメニュースの編集者です。資料（記事の見出しと短い要約）だけを根拠に、「放送・配信スケジュール」に載せる情報を読み取ります。
- アニメ作品のテレビ放送・ネット配信・劇場公開の始まりだけを対象にする。PV・ビジュアル・キャストの発表だけで始まる日が書かれていない記事、グッズ・イベント・見られるサービスの案内は isSchedule を false にする。
- 資料に書かれていることだけを使う。作品名・日付・放送局を推測しない。
- 作品名は資料の表記のまま。「第2期」「Season 2」なども資料にあればそのまま含める。
- 始まる日は資料に書かれている精度で書く（日まで→YYYY-MM-DD、月まで→YYYY-MM）。「今秋」「2027年」のように月が書かれていなければ isSchedule を false にする。`;

export function buildAnimePrompt(articles: { publisher: string; publishedAt: Date; title: string; summary: string | null }[]) {
  const lines = articles.map((a, i) => `[${i + 1}] ${publisherLabel(a.publisher)}／${formatDateTime(a.publishedAt)}\n見出し: ${a.title}\n要約: ${a.summary ?? "（なし）"}`);
  return `次の資料から、アニメの放送・配信・劇場公開の情報を読み取ってください。\n\n${lines.join("\n\n")}`;
}

const fold = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[\s「」『』]/g, "");

/** 資料と照らし合わせる。作品名が資料にそのまま書かれ、始まる日（日か月）が資料にあるものだけ残す。放送局は資料になければ外す */
export function verifyAnime(a: AnimeExtract["anime"] | undefined, sourceText: string): NonNullable<AnimeExtract["anime"]> | null {
  if (!a) return null;
  const title = a.title.trim().replace(/^[「『]|[」』]$/g, "");
  if (!title || [...title].length > 40) return null;
  const corpus = fold(sourceText);
  if (!corpus.includes(fold(title))) return null;
  const date = verifyDate(a.date, sourceText);
  if (!date || !/^\d{4}-\d{2}(-\d{2})?$/.test(date)) return null;
  const channel = a.channel?.trim() && corpus.includes(fold(a.channel)) ? a.channel.trim() : null;
  return { title, date, kind: a.kind, channel };
}

/** まだ確かめていない、アニメの放送・配信の候補の話題（話題の大きい順） */
export async function findAnimeCandidates(limit: number, now = new Date()) {
  const topics = await prisma.topic.findMany({
    where: { genre: { slug: { in: ANIME_GENRES } }, aiAnimeChecked: false, firstSeenAt: { gte: new Date(now.getTime() - CANDIDATE_DAYS * 86_400_000) } },
    orderBy: [{ score: "desc" }, { firstSeenAt: "desc" }],
    take: 800,
    select: {
      id: true,
      title: true,
      genre: { select: { slug: true } },
      articles: { take: 3, orderBy: { publishedAt: "asc" }, select: { title: true, summary: true, publisher: true, publishedAt: true } },
    },
  });
  return topics
    .filter((t) => isAnimeCandidate([t.title, ...t.articles.map((a) => `${a.title} ${a.summary ?? ""}`)].join(" "), t.genre.slug))
    .slice(0, limit);
}

/** 読み取りの結果を、資料と照合して保存する */
export async function saveAnimeExtract(topicId: number, result: AnimeExtract) {
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { articles: { select: { title: true, summary: true } } } });
  if (!topic) throw new Error("topic not found");
  const corpus = topic.articles.map((a) => `${a.title}\n${a.summary ?? ""}`).join("\n");
  const anime = result.isSchedule ? verifyAnime(result.anime, corpus) : null;
  await prisma.topic.update({
    where: { id: topicId },
    data: {
      aiAnimeChecked: true,
      aiAnimeTitle: anime?.title ?? null,
      aiAnimeDate: anime?.date ?? null,
      aiAnimeKind: anime?.kind ?? null,
      aiAnimeChannel: anime?.channel ?? null,
    },
  });
  return { saved: anime };
}

/** 指定した月（YYYY-MM の配列）に始まる放送・配信・劇場公開。同じ作品・同じ種類は1件にまとめ、日付順（月だけのものはその月の最後） */
export async function getAnimeSchedule(months: string[]): Promise<AnimeItem[]> {
  const topics = await prisma.topic.findMany({
    where: { aiAnimeTitle: { not: null }, OR: months.map((m) => ({ aiAnimeDate: { startsWith: m } })) },
    orderBy: [{ score: "desc" }, { lastSeenAt: "desc" }],
    take: 500,
    select: { id: true, aiAnimeTitle: true, aiAnimeDate: true, aiAnimeKind: true, aiAnimeChannel: true },
  });
  return sortAnime([
    ...topics.map((t) => ({
      topicId: t.id,
      title: t.aiAnimeTitle!,
      date: t.aiAnimeDate!,
      kind: (t.aiAnimeKind ?? "other") as AnimeKind,
      channel: t.aiAnimeChannel,
    })),
    ...(await getListedAnime(months)),
  ]);
}

/** 映画の題名を、アニメの話題の見出しと比べるための形。題名全体と、最初の区切りまで（5字以上のとき） */
export function filmKeys(title: string): string[] {
  const full = fold(title);
  const head = fold(title.split(/[\s　\-－―~〜:：]/)[0] ?? "");
  return [...new Set([full, ...(head.length >= 5 ? [head] : [])])].filter((k) => k.length >= 4);
}

/**
 * 公開・放送の予定の一覧（Wikipedia から取り込んだもの）にある作品。
 * - 映画の公開予定（src/lib/movie-listings.ts）は、アニメかどうかが書かれていないため、
 *   アニメ・漫画のジャンルの話題の見出しに題名が出てくる作品だけをアニメの映画とみなす
 * - テレビアニメの放送開始予定（src/lib/anime-listings.ts）は、すべて載せる。見出しに題名が出てくる話題があれば、その話題へつなぐ
 */
async function getListedAnime(months: string[]): Promise<AnimeItem[]> {
  const inMonths = (field: "release" | "start") => ({ OR: months.map((m) => ({ [field]: { startsWith: m } })) });
  const [films, shows] = await Promise.all([
    prisma.movieListing.findMany({ where: inMonths("release"), select: { title: true, release: true } }),
    prisma.animeListing.findMany({ where: inMonths("start"), select: { title: true, start: true, channel: true } }),
  ]);
  if (films.length + shows.length === 0) return [];
  const topics = await prisma.topic.findMany({
    where: { genre: { slug: "anime" }, lastSeenAt: { gte: new Date(Date.now() - 180 * 86_400_000) } },
    orderBy: { score: "desc" },
    take: 3000,
    select: { id: true, title: true, aiTitle: true },
  });
  const heads = topics.map((t) => ({ id: t.id, text: fold(`${t.title} ${t.aiTitle ?? ""}`) }));
  const topicFor = (title: string) => {
    const keys = filmKeys(title);
    return heads.find((h) => keys.some((k) => h.text.includes(k)))?.id ?? null;
  };
  return [
    ...films.flatMap((f) => {
      const id = topicFor(f.title);
      return id ? [{ topicId: id, title: f.title, date: f.release, kind: "movie" as const, channel: null }] : [];
    }),
    ...shows.map((s) => ({ topicId: topicFor(s.title), title: s.title, date: s.start, kind: "tv" as const, channel: s.channel })),
  ];
}

/** 同じ作品・同じ種類は1件に（話題の大きいものを残す。月だけのものより、日まで分かるものを優先する）して、日付順に並べる */
export function sortAnime(items: AnimeItem[]): AnimeItem[] {
  const byKey = new Map<string, AnimeItem>();
  for (const it of items) {
    const key = `${fold(it.title)}|${it.kind}`;
    const prev = byKey.get(key);
    if (!prev) byKey.set(key, it);
    else if (prev.date.length === 7 && it.date.length === 10 && it.date.startsWith(prev.date)) byKey.set(key, { ...it, channel: it.channel ?? prev.channel });
  }
  const sortKey = (d: string) => (d.length === 7 ? `${d}-32` : d);
  return [...byKey.values()].sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date)));
}
