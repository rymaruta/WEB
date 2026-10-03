/**
 * 公開 URL。NEXT_PUBLIC_SITE_URL を優先し、未設定なら Vercel が自動で設定する本番ドメインを使う。
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const siteConfig = {
  name: "ぜんぶナビ",
  tagline: "ニュースも話題も、ぜんぶここで。",
  description:
    "国内・国際・経済・IT・エンタメ・スポーツ・グルメ新商品まで、主要メディアの最新ニュースをジャンル横断でまとめて届ける総合ポータル。",
  url: siteUrl,
  contactEmail: process.env.CONTACT_EMAIL ?? "contact@example.com",
  /** 運営者の表示名（屋号） */
  operator: "ぜんぶナビ編集部",
  /** 運営開始 */
  launchedAt: "2026年9月",
  /** 公式 X アカウント（構造化データの sameAs などに使う） */
  xUrl: "https://x.com/ZenbuNavi",
  crawlerUserAgent: `ZenbuNaviBot/1.0 (+${siteUrl}/about)`,
  /** Google AdSense のサイト運営者 ID（公開情報）。空にすると広告のコードを読み込まない */
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-7935293964724460",
  /** Google アナリティクス 4 の測定 ID（公開情報）。空にすると計測のコードを読み込まない */
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-FCN9Q3839P",
} as const;
