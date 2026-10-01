import { siteConfig } from "@/config/site";
import { OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = siteConfig.name;
export const size = OG_SIZE;
export const contentType = "image/png";
// ビルド時にフォントを取れなかった場合でも、1日で作り直されるようにする
export const revalidate = 86400;

export default function Image() {
  return renderOgCard({ title: siteConfig.tagline, note: "主要メディアのニュースをジャンル横断で" });
}
