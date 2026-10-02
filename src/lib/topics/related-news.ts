import { cache } from "react";
import { prisma } from "@/lib/db";
import { topicCardInclude } from "@/lib/queries";

/** 似ていると見なす見出しの近さ（文字の3字組の重なり。0〜1） */
const MIN_SIMILARITY = 0.2;
/** 探す範囲（日数） */
const RELATED_DAYS = 180;

/**
 * 記事ページの「関連するニュース」。見出しが似ている話題（同じ出来事の前後の報道や、同じ人・会社の別の話題）を、似ている順に返す。
 * 同じジャンルの新着とは別に、その話題を追いかけたい人の次の行き先にする
 */
export const getRelatedNews = cache(async (topicId: number, take = 5) => {
  const [, rows] = await prisma.$transaction([
    // 索引（Topic_title_trgm_idx）を使える「%」の基準を、この問い合わせの間だけ下げる
    prisma.$executeRaw`SELECT set_config('pg_trgm.similarity_threshold', ${String(MIN_SIMILARITY)}, true)`,
    prisma.$queryRaw<{ id: number; sim: number }[]>`
      SELECT r.id, similarity(r.title, t.title) AS sim
      FROM "Topic" r, (SELECT title FROM "Topic" WHERE id = ${topicId}) t
      WHERE r.title % t.title
        AND r.id <> ${topicId}
        AND r."mergedIntoId" IS NULL
        AND r."aiNotNews" = false
        AND r."lastSeenAt" >= ${new Date(Date.now() - RELATED_DAYS * 86_400_000)}
      ORDER BY sim DESC, r."lastSeenAt" DESC
      LIMIT ${take * 2}`,
  ]);
  if (rows.length === 0) return [];
  const order = new Map(rows.map((r, i) => [r.id, i]));
  const topics = await prisma.topic.findMany({ where: { id: { in: rows.map((r) => r.id) } }, include: topicCardInclude });
  // 見出しがほぼ同じ（同じ記事の別の話題）は1つにする
  const seen = new Set<string>();
  return topics
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    .filter((t) => {
      const k = (t.aiTitle ?? t.title).normalize("NFKC").replace(/\s+/g, "");
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .slice(0, take);
});
