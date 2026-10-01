import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { xml } from "@/lib/xml";

export const revalidate = 600;

/** RSS 2.0。新しく作成・更新したまとめ記事（RSS リーダーで読む人向け） */
export async function GET() {
  const topics = await prisma.topic.findMany({
    where: { aiGeneratedAt: { not: null }, aiTitle: { not: null } },
    orderBy: { aiGeneratedAt: "desc" },
    take: 50,
    select: { id: true, aiTitle: true, aiLead: true, aiGeneratedAt: true, genre: { select: { name: true } } },
  });
  const items = topics
    .map((t) => {
      const url = `${siteConfig.url}/topic/${t.id}`;
      return `<item><title>${xml(t.aiTitle!)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${t.aiGeneratedAt!.toUTCString()}</pubDate><category>${xml(t.genre.name)}</category>${t.aiLead ? `<description>${xml(t.aiLead)}</description>` : ""}</item>`;
    })
    .join("");
  const updated = topics[0]?.aiGeneratedAt ?? new Date();
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xml(siteConfig.name)}（まとめ記事）</title><link>${siteConfig.url}</link><atom:link href="${siteConfig.url}/feed.xml" rel="self" type="application/rss+xml"/><description>複数の媒体が報じたニュースを、各社の報道をもとにまとめた記事</description><language>ja</language><lastBuildDate>${updated.toUTCString()}</lastBuildDate>${items}</channel></rss>`,
    { headers: { "content-type": "application/rss+xml; charset=utf-8" } },
  );
}
