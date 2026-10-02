import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { extractFacts, factInSources } from "@/lib/stories/verify";

/**
 * まとめ記事の「これまでの経緯」。
 * このサイトが過去に書いたまとめ記事のうち、見出しが似ている（同じ出来事の続きらしい）ものを材料として渡し、
 * 執筆者がそれを1文ずつにまとめる。材料はこのサイト自身の記録なので、他社の記事を写さずに記事を厚くできる。
 * 書かれた文は、材料の見出し・リードと照合し、材料にない数字や固有名詞があれば載せない
 */

export type RelatedTopic = { id: number; firstSeenAt: Date; title: string; lead: string };
export type BackgroundItem = { topicId: number; text: string };

/** 材料にする過去の話題の数と、さかのぼる期間 */
const RELATED_LIMIT = 5;
const RELATED_DAYS = 60;
/** 見出しの似かた（pg_trgm の similarity）がこれ以上のものだけ */
const MIN_SIMILARITY = 0.2;
/** 載せる経緯の数 */
export const MAX_BACKGROUND = 3;

/** この話題より前に書いた、見出しの似たまとめ記事（似ている順） */
export async function findRelatedEarlier(topicId: number, now = new Date()): Promise<RelatedTopic[]> {
  const since = new Date(now.getTime() - RELATED_DAYS * 86_400_000);
  const rows = await prisma.$queryRaw<{ id: number; firstSeenAt: Date; title: string; lead: string | null }[]>`
    SELECT r.id, r."firstSeenAt", r."aiTitle" AS title, r."aiLead" AS lead
    FROM "Topic" t
    JOIN "Topic" r ON r.id <> t.id
    WHERE t.id = ${topicId}
      AND r."aiGeneratedAt" IS NOT NULL AND r."aiTitle" IS NOT NULL
      AND r."mergedIntoId" IS NULL
      AND r."firstSeenAt" >= ${since}
      AND r."firstSeenAt" < t."firstSeenAt" - interval '6 hours'
      AND similarity(r.title, t.title) >= ${MIN_SIMILARITY}
    ORDER BY similarity(r.title, t.title) DESC
    LIMIT ${RELATED_LIMIT}`;
  return rows.map((r) => ({ id: r.id, firstSeenAt: r.firstSeenAt, title: r.title, lead: r.lead ?? "" }));
}

/** 執筆者に渡す材料の文（資料番号とは別に、id で区別する） */
export function buildRelatedPrompt(related: RelatedTopic[]): string {
  if (related.length === 0) return "";
  const lines = related.map((r) => `{id: ${r.id}} ${formatDateTime(r.firstSeenAt)}\n見出し: ${r.title}\nリード: ${r.lead || "（なし）"}`);
  return `\n\n参考：このサイトの過去のまとめ記事（background に使える材料。今回の資料ではない）\n\n${lines.join("\n\n")}`;
}

/**
 * 経緯の文を検証する。材料にある話題だけ、材料の見出し・リードにない数字や固有名詞を含まないものだけを、古い順に残す
 */
export function verifyBackground(items: BackgroundItem[] | null | undefined, related: RelatedTopic[]): BackgroundItem[] {
  if (!items?.length) return [];
  const byId = new Map(related.map((r) => [r.id, r]));
  const seen = new Set<number>();
  const out: (BackgroundItem & { at: number })[] = [];
  for (const it of items) {
    const r = byId.get(it.topicId);
    const text = it.text.trim();
    if (!r || !text || seen.has(r.id) || text.length > 120) continue;
    const corpus = `${formatDateTime(r.firstSeenAt)} ${r.title} ${r.lead}`;
    if (extractFacts(text).some((f) => !factInSources(f, corpus))) continue;
    seen.add(r.id);
    out.push({ topicId: r.id, text, at: r.firstSeenAt.getTime() });
  }
  return out
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_BACKGROUND)
    .map(({ topicId, text }) => ({ topicId, text }));
}
