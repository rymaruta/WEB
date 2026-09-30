export const siteConfig = {
  name: "ぜんぶナビ",
  tagline: "ニュースも話題も、ぜんぶここで。",
  description:
    "国内・国際・経済・IT・エンタメ・スポーツ・グルメ新商品まで、主要メディアの最新ニュースをジャンル横断でまとめて届ける総合ポータル。",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  contactEmail: process.env.CONTACT_EMAIL ?? "contact@example.com",
  crawlerUserAgent:
    "ZenbuNaviBot/1.0 (+" + (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000") + "/about)",
} as const;
