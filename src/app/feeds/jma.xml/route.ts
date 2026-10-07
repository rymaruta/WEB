import { buildJmaRss } from "@/lib/jma-feed";

export const revalidate = 120;

/**
 * 気象庁の防災情報（地震・津波・火山）のうち大きな出来事を RSS にしたもの（src/lib/jma.ts）。
 * 収集（prisma/catalog.ts の「気象庁 防災情報」）は、この URL を HTTP で取らずに同じ処理で直接作る（src/lib/crawl/fetch-feed.ts）
 */
export async function GET() {
  return new Response(await buildJmaRss(), { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
