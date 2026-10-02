import { siteConfig } from "@/config/site";

/**
 * IndexNow（Bing などの検索エンジンに、新しいページ・更新したページをすぐ知らせる仕組み）。
 * 鍵は公開してよい値で、同じ値のファイルを public/<鍵>.txt に置いている（検索エンジンが持ち主の確認に使う）。
 * Google は IndexNow を使わないため、Google にはサイトマップで知らせる。
 */
export const INDEXNOW_KEY = "450cb2b39e2c96416f9ce9c372db289e";

/** ページの URL（パス）を検索エンジンに知らせる。失敗しても記事の保存などは止めない */
export async function submitIndexNow(paths: string[]): Promise<void> {
  if (process.env.NODE_ENV !== "production" || paths.length === 0) return;
  const host = new URL(siteConfig.url).host;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${siteConfig.url}/${INDEXNOW_KEY}.txt`,
        urlList: paths.map((p) => `${siteConfig.url}${p}`),
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // 知らせられなくても、サイトマップから見つけてもらえる
  }
}
