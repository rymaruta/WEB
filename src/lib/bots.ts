/**
 * 人でないアクセス（検索エンジン・リンクの下見・監視・スクリプト）。閲覧数・クリック数に数えない。
 * 利用者の端末情報は保存せず、判定にだけ使う
 */
const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|python|curl|wget|httpclient|java\/|go-http|axios|node-fetch|undici|okhttp|scrapy|monitor|uptime|pingdom|feedfetcher|rss|validator/i;

/** user-agent が空のものも人ではないとみなす */
export const isBot = (ua: string | null | undefined) => !ua || BOT_UA.test(ua);

/** 同じ人が同じ記事を続けて開いたときに、1回だけ数える期間（秒） */
export const CLICK_DEDUPE_SECONDS = 30 * 60;
const COOKIE = "zn_go";
const KEEP = 30;

/** 直近に数えた記事の id（Cookie。個人を特定する情報は入れない） */
export function recentClicks(cookieHeader: string | null): number[] {
  const m = (cookieHeader ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9.]*)`));
  return m ? m[1].split(".").map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
}

/** 記事を数えたあとの Cookie（新しいものを先に、KEEP 件まで） */
export function clickCookie(recent: number[], id: number): string {
  const ids = [id, ...recent.filter((x) => x !== id)].slice(0, KEEP);
  return `${COOKIE}=${ids.join(".")}; Max-Age=${CLICK_DEDUPE_SECONDS}; Path=/go; HttpOnly; Secure; SameSite=Lax`;
}
