import { cache } from "react";
import { originalReports, type CoverageArticle } from "@/lib/coverage";
import { prisma } from "@/lib/db";
import { isGovernment } from "@/lib/government";

/**
 * ニュースのその後。同じ出来事について、最初の報道のあとに何があったかを新しい順に並べる。
 * - 報道の動き: 日ごと（日本時間）に、新しく報じた媒体と、その日のいちばん新しい見出し（記録を数えるだけ。AI は使わない）
 * - 続報で分かったこと: 配信用の解析で、前回の配信から新しく分かった事実（資料と照合済み。根拠の記事へのリンク付き）
 * - 公式の発表: 同じ出来事にまとまった官公庁・企業の発表
 */

export type UpdateLink = { articleId: number; publisher: string };

export type TopicUpdate =
  | { kind: "reports"; at: Date; day: string; newOutlets: string[]; headline: { articleId: number; publisher: string; title: string } }
  | { kind: "facts"; at: Date; topicId: number; now: { text: string; links: UpdateLink[] } | null; facts: { text: string; links: UpdateLink[] }[] }
  | { kind: "official"; at: Date; articleId: number; publisher: string; government: boolean; title: string };

export type DeltaRow = {
  topicId: number;
  analyzedAt: Date;
  delta: unknown;
  sources: { position: number; articleId: number; publisher: string }[];
};

const JST_MS = 9 * 3_600_000;
const jstDay = (d: Date) => new Date(d.getTime() + JST_MS).toISOString().slice(0, 10);

/** 表示する続報の差分（配信の候補になったもの。除外・確認待ちのものは出さない） */
export const SHOWN_DELTA_STATUSES = ["PENDING", "APPROVED", "PUBLISHED"] as const;
const MAX_UPDATES = 12;

type Sourced = { text: string; sources: number[] };
const isSourced = (v: unknown): v is Sourced =>
  !!v && typeof v === "object" && typeof (v as Sourced).text === "string" && Array.isArray((v as Sourced).sources);

function links(s: Sourced, byPosition: Map<number, UpdateLink>): UpdateLink[] {
  return s.sources.flatMap((p) => (byPosition.has(p) ? [byPosition.get(p)!] : []));
}

/** 続報の差分を表示の形にする。根拠の記事が1つもない文は出さない（出典を追えない文は載せない） */
export function deltaUpdate(row: DeltaRow): Extract<TopicUpdate, { kind: "facts" }> | null {
  const d = row.delta as { now?: unknown; newFacts?: unknown } | null;
  if (!d) return null;
  const byPosition = new Map(row.sources.map((s) => [s.position, { articleId: s.articleId, publisher: s.publisher }]));
  const now = isSourced(d.now) ? { text: d.now.text, links: links(d.now, byPosition) } : null;
  const facts = (Array.isArray(d.newFacts) ? d.newFacts : []).filter(isSourced).map((f) => ({ text: f.text, links: links(f, byPosition) }));
  const shownFacts = facts.filter((f) => f.text && f.links.length > 0);
  const shownNow = now && now.text && now.links.length > 0 ? now : null;
  if (!shownNow && shownFacts.length === 0) return null;
  return { kind: "facts", at: row.analyzedAt, topicId: row.topicId, now: shownNow, facts: shownFacts };
}

/**
 * 第一報からこの時間までの報道は、第一報と同じ波（同じ発表を各社が追いかけたもの）として「その後」に入れない。
 * 日付の区切りだけで分けると、深夜の第一報の数分後の記事が「翌日の新たな報道」になってしまう（src/lib/topics/brief.ts と同じ間隔）
 */
export const FIRST_WAVE_HOURS = 12;

/**
 * 報道の動きを日ごと（日本時間）にまとめる。第一報から FIRST_WAVE_HOURS 時間までの報道は第一報として別に出すため、それより後だけを返す。
 * 転載・再配信は数えない
 */
export function reportDays(articles: CoverageArticle[]): Extract<TopicUpdate, { kind: "reports" }>[] {
  const news = originalReports(articles);
  if (news.length === 0) return [];
  const waveEnd = news[0].publishedAt.getTime() + FIRST_WAVE_HOURS * 3_600_000;
  const seen = new Set<string>();
  const byDay = new Map<string, { newOutlets: string[]; last: CoverageArticle }>();
  for (const a of news) {
    const later = a.publishedAt.getTime() > waveEnd;
    const isNew = !seen.has(a.publisher);
    seen.add(a.publisher);
    if (!later) continue;
    const day = jstDay(a.publishedAt);
    const entry = byDay.get(day) ?? { newOutlets: [], last: a };
    if (isNew) entry.newOutlets.push(a.publisher);
    entry.last = a;
    byDay.set(day, entry);
  }
  return [...byDay]
    .map(([day, e]) => ({
      kind: "reports" as const,
      at: e.last.publishedAt,
      day,
      newOutlets: e.newOutlets,
      headline: { articleId: e.last.id, publisher: e.last.publisher, title: e.last.title },
    }));
}

/** 公式の発表（官公庁・企業。報道とは分けて示す） */
export function officialUpdates(articles: CoverageArticle[]): Extract<TopicUpdate, { kind: "official" }>[] {
  return articles
    .filter((a) => a.kind === "PRESS")
    .map((a) => ({ kind: "official" as const, at: a.publishedAt, articleId: a.id, publisher: a.publisher, government: isGovernment(a.publisher), title: a.title }));
}

/** 公式の発表と最初の報道の時間の差（分）。発表より先に報道があれば before。発表か報道がなければ null */
export function officialLag(articles: CoverageArticle[]): { publisher: string; minutes: number; before: boolean } | null {
  const press = articles.filter((a) => a.kind === "PRESS").sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())[0];
  const news = originalReports(articles)[0];
  if (!press || !news) return null;
  const minutes = Math.round((news.publishedAt.getTime() - press.publishedAt.getTime()) / 60_000);
  return { publisher: press.publisher, minutes: Math.abs(minutes), before: minutes < 0 };
}

/** その後の動きを新しい順に並べる（最大 MAX_UPDATES 件） */
export function buildUpdates(articles: CoverageArticle[], deltas: DeltaRow[]): TopicUpdate[] {
  const all: TopicUpdate[] = [
    ...reportDays(articles),
    ...officialUpdates(articles),
    ...deltas.flatMap((d) => {
      const u = deltaUpdate(d);
      return u ? [u] : [];
    }),
  ];
  return all.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, MAX_UPDATES);
}

/** 話題（と同じ出来事の話題）の、表示してよい続報の差分 */
export const getTopicDeltas = cache(async (topicIds: number[]): Promise<DeltaRow[]> => {
  const rows = await prisma.story.findMany({
    where: { topicId: { in: topicIds }, kind: "FOLLOWUP", status: { in: [...SHOWN_DELTA_STATUSES] }, analyzedAt: { not: null } },
    orderBy: { analyzedAt: "desc" },
    take: 10,
    select: { topicId: true, analyzedAt: true, delta: true, sources: { select: { position: true, articleId: true, publisher: true } } },
  });
  return rows.map((r) => ({ topicId: r.topicId, analyzedAt: r.analyzedAt!, delta: r.delta, sources: r.sources }));
});

/** 「3行でわかる」の「その後」に出す、いちばん新しい動きの1文 */
export function latestUpdateText(updates: TopicUpdate[], label: (publisher: string) => string): { text: string; at: Date } | null {
  const u = updates[0];
  if (!u) return null;
  if (u.kind === "facts") return { text: u.now?.text ?? u.facts[0].text, at: u.at };
  if (u.kind === "official") return { text: `${label(u.publisher)}が発表：${u.title}`, at: u.at };
  return { text: u.newOutlets.length > 0 ? `${u.newOutlets.length}社が新たに報道：${u.headline.title}` : `続報：${u.headline.title}`, at: u.at };
}
