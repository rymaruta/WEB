import { isIndexableArticle, jsonLength } from "@/lib/indexing";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { xml } from "@/lib/xml";

export const revalidate = 600;

/**
 * Google ニュース用のサイトマップ。直近2日に作成・更新したまとめ記事だけを載せる（Google ニュースの決まり）
 */
export async function GET() {
  const topics = await prisma.topic.findMany({
    where: { aiGeneratedAt: { gte: new Date(Date.now() - 48 * 3_600_000) }, aiTitle: { not: null }, mergedIntoId: null },
    orderBy: { aiGeneratedAt: "desc" },
    take: 1000,
    select: { id: true, aiTitle: true, aiGeneratedAt: true, publisherCount: true, aiAngles: true, aiBackground: true, aiPoints: true, reviewStatus: true },
  });
  // 登録の基準は話題のページと同じ（src/lib/indexing.ts）
  const indexable = topics.filter((t) => isIndexableArticle({
        publisherCount: t.publisherCount,
        hasAi: true,
        angles: jsonLength(t.aiAngles),
        background: jsonLength(t.aiBackground),
        points: jsonLength(t.aiPoints),
        held: t.reviewStatus === "hold",
      }));
  const body = indexable
    .map(
      (t) => `<url><loc>${siteConfig.url}/topic/${t.id}</loc><news:news><news:publication><news:name>${xml(siteConfig.name)}</news:name><news:language>ja</news:language></news:publication><news:publication_date>${t.aiGeneratedAt!.toISOString()}</news:publication_date><news:title>${xml(t.aiTitle!)}</news:title></news:news></url>`,
    )
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${body}</urlset>`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
}
