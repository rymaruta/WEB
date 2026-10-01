import { readCompanyParam } from "@/lib/company";
import { OG_SIZE, renderOgCard } from "@/lib/og-card";
import { getCompanyTopics } from "@/lib/queries";

export const alt = "企業別ニュース";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

/** 企業ページを共有したときの画像。企業名と、最新の話題の見出し */
export default async function Image({ params }: { params: Promise<{ name: string }> }) {
  const name = readCompanyParam((await params).name);
  const { items, total } = await getCompanyTopics(name, 0, 1);
  if (total === 0) return renderOgCard({ title: "" });
  const latest = items[0];
  return renderOgCard({
    title: `${name}のニュース`,
    label: "企業別ニュース",
    note: `話題${total}件・最新：${(latest.aiTitle ?? latest.title).slice(0, 30)}`,
  });
}
