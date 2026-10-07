import { siteConfig } from "@/config/site";
import { fetchJmaItems } from "@/lib/jma";
import { xml } from "@/lib/xml";

export const revalidate = 120;

/**
 * 気象庁の防災情報（地震・津波・火山）のうち大きな出来事を、ニュースの集め元として読める RSS にしたもの（src/lib/jma.ts）。
 * このサイトの収集（prisma/catalog.ts の「気象庁」）が読み、報道と同じ話題にまとめる。出典は気象庁
 */
export async function GET() {
  let items: Awaited<ReturnType<typeof fetchJmaItems>> = [];
  try {
    items = await fetchJmaItems(fetch, siteConfig.crawlerUserAgent);
  } catch {
    // 気象庁に届かないときは空の RSS を返す（収集の失敗として何度も数えない）
  }
  const body = items
    .map((i) => `<item><title>${xml(i.title)}</title><link>${xml(i.url)}</link><guid isPermaLink="false">${xml(i.url)}</guid><pubDate>${i.publishedAt.toUTCString()}</pubDate><description>${xml(`${i.summary}（出典：気象庁ホームページ https://www.jma.go.jp/ の防災情報 XML をもとに、ぜんぶナビが作成）`)}</description></item>`)
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>気象庁 防災情報（${xml(siteConfig.name)}）</title><link>https://www.jma.go.jp/bosai/</link><description>気象庁の防災情報 XML から、地震（最大震度4以上）・津波警報/注意報・噴火速報/噴火警報をまとめたもの。出典：気象庁ホームページ（https://www.jma.go.jp/）。電文の値（震度・規模・警報の種類）は変えずに、ぜんぶナビが見出しと要約を作成</description><language>ja</language>${body}</channel></rss>`,
    { headers: { "content-type": "application/rss+xml; charset=utf-8" } },
  );
}
