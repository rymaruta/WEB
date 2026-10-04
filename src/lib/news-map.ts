import { cache } from "react";
import { companyPath } from "@/lib/company";
import { prisma } from "@/lib/db";
import { COUNTRIES, matchesTag, TEAMS, tagPath } from "@/lib/tags";
import { workKey, workPath } from "@/lib/work-keys";

/**
 * ニュース相関図。ある企業と「同じニュース（話題）に一緒に出てきた」企業・作品・国・チームを、根拠の話題つきで並べる。
 * - 結び付けるのは、同じ話題に名前が出たという事実だけ。関係の種類（提携・競合など）は書かない（AI に推測させない）
 * - 企業名はまとめ記事で資料と照合したもの、作品名は読み取った発売・放送の情報、国・チームは決まった言葉の一覧（src/lib/tags.ts）
 * - 人物は扱わない（同じ記事に出ただけで人と組織を結び付けると、誤解を招くことがあるため）
 */

export type MapEntityKind = "company" | "game" | "anime" | "country" | "team";

export type MapEntity = { kind: MapEntityKind; key: string; name: string; href: string };

export type MapTopic = {
  id: number;
  title: string;
  aiTitle: string | null;
  aiCompanies: string[];
  aiGameTitle: string | null;
  aiGameKey: string | null;
  aiAnimeTitle: string | null;
  firstSeenAt: Date;
};

export type MapLink = { entity: MapEntity; count: number; topics: { id: number; title: string }[] };

export const MAP_KIND_LABELS: Record<MapEntityKind, string> = { company: "企業", game: "ゲーム", anime: "アニメ", country: "国・地域", team: "チーム" };

/** 図に出す数（多いと読めないため） */
export const MAP_MAX_LINKS = 8;
/** 1つのつながりに示す根拠の話題の数 */
const EVIDENCE = 3;

/** 話題に出てくる企業・作品・国・チーム */
export function topicEntities(t: MapTopic): MapEntity[] {
  const title = t.aiTitle ?? t.title;
  const out: MapEntity[] = t.aiCompanies.map((c) => ({ kind: "company" as const, key: c, name: c, href: companyPath(c) }));
  if (t.aiGameTitle) {
    const key = workKey(t.aiGameKey || t.aiGameTitle);
    out.push({ kind: "game", key, name: t.aiGameTitle, href: workPath("game", key) });
  }
  if (t.aiAnimeTitle) {
    const key = workKey(t.aiAnimeTitle);
    out.push({ kind: "anime", key, name: t.aiAnimeTitle, href: workPath("anime", key) });
  }
  for (const tag of [...COUNTRIES, ...TEAMS]) if (matchesTag(tag, title)) out.push({ kind: tag.kind, key: tag.slug, name: tag.name, href: tagPath(tag) });
  return out;
}

/**
 * 中心の企業と同じ話題に出たものを、一緒に出た話題の数の多い順に（同じ数なら最近の話題があるもの）。
 * 根拠の話題は新しい順に EVIDENCE 件
 */
export function buildNewsMap(center: { kind: MapEntityKind; key: string }, topics: MapTopic[], max = MAP_MAX_LINKS): MapLink[] {
  const links = new Map<string, MapLink & { latest: number }>();
  const sorted = [...topics].sort((a, b) => b.firstSeenAt.getTime() - a.firstSeenAt.getTime());
  for (const t of sorted) {
    const seen = new Set<string>();
    for (const e of topicEntities(t)) {
      const id = `${e.kind}:${e.key}`;
      if ((e.kind === center.kind && e.key === center.key) || seen.has(id)) continue;
      seen.add(id);
      const link = links.get(id) ?? { entity: e, count: 0, topics: [], latest: t.firstSeenAt.getTime() };
      link.count++;
      if (link.topics.length < EVIDENCE) link.topics.push({ id: t.id, title: t.aiTitle ?? t.title });
      links.set(id, link);
    }
  }
  return [...links.values()]
    .sort((a, b) => b.count - a.count || b.latest - a.latest || a.entity.name.localeCompare(b.entity.name))
    .slice(0, max)
    .map((l) => ({ entity: l.entity, count: l.count, topics: l.topics }));
}

/** 企業の相関図（直近 days 日の話題から） */
export const getCompanyMap = cache(async (name: string, days = 180) => {
  const topics = await prisma.topic.findMany({
    where: { aiCompanies: { has: name }, mergedIntoId: null, lastSeenAt: { gte: new Date(Date.now() - days * 86_400_000) } },
    orderBy: { lastSeenAt: "desc" },
    take: 300,
    select: { id: true, title: true, aiTitle: true, aiCompanies: true, aiGameTitle: true, aiGameKey: true, aiAnimeTitle: true, firstSeenAt: true },
  });
  return buildNewsMap({ kind: "company", key: name }, topics);
});
