/** 閲覧の流入元の分類と、記録するパスの整形。DB に依存しない部分 */

export const SOURCES = ["x", "google", "google_news", "yahoo", "bing", "social", "direct", "other"] as const;
export type TrafficSource = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<TrafficSource, string> = {
  x: "X（旧 Twitter）",
  google: "Google 検索",
  google_news: "Google ニュース・Discover",
  yahoo: "Yahoo!",
  bing: "Bing",
  social: "その他の SNS",
  direct: "直接・ブックマーク",
  other: "その他のサイト",
};

/** 参照元の URL から流入元を決める。自サイト内の移動は null（数えない） */
export function classifyReferrer(referrer: string, siteHost: string): TrafficSource | null {
  if (!referrer) return "direct";
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "other";
  }
  if (host === siteHost || host.endsWith(`.${siteHost}`)) return null;
  if (host === "t.co" || host === "x.com" || host.endsWith(".x.com") || host.endsWith("twitter.com")) return "x";
  if (host === "news.google.com" || host === "discover.google.com") return "google_news";
  if (/(^|\.)google\.[a-z.]+$/.test(host) || host === "com.google.android.googlequicksearchbox") return "google";
  if (host.endsWith("yahoo.co.jp") || host.endsWith("yahoo.com")) return "yahoo";
  if (host.endsWith("bing.com")) return "bing";
  if (/(facebook|instagram|threads|line|bsky|mastodon|reddit|hatena)\./.test(host) || host === "lin.ee") return "social";
  return "other";
}

/** 記録するパス。クエリやハッシュを除き、長さを制限し、管理画面や API は数えない */
export function normalizePath(path: string): string | null {
  const p = path.split(/[?#]/)[0].slice(0, 120);
  if (!p.startsWith("/") || p.startsWith("/admin") || p.startsWith("/api") || p.startsWith("/go")) return null;
  return p.length > 1 ? p.replace(/\/+$/, "") : "/";
}
