import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";

export const revalidate = 600;

const xml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/**
 * Google ニュース用のサイトマップ。直近2日に作成・更新したまとめ記事だけを載せる（Google ニュースの決まり）
 */
export async function GET() {
  const topics = await prisma.topic.findMany({
    where: { aiGeneratedAt: { gte: new Date(Date.now() - 48 * 3_600_000) }, aiTitle: { not: null } },
    orderBy: { aiGeneratedAt: "desc" },
    take: 1000,
    select: { id: true, aiTitle: true, aiGeneratedAt: true },
  });
  const body = topics
    .map(
      (t) => `<url><loc>${siteConfig.url}/topic/${t.id}</loc><news:news><news:publication><news:name>${xml(siteConfig.name)}</news:name><news:language>ja</news:language></news:publication><news:publication_date>${t.aiGeneratedAt!.toISOString()}</news:publication_date><news:title>${xml(t.aiTitle!)}</news:title></news:news></url>`,
    )
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${body}</urlset>`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
}
