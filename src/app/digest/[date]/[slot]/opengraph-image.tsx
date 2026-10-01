import { getPublishedDigest, isDate, slotFromSlug } from "@/lib/digest/archive";
import { OG_SIZE, renderOgCard } from "@/lib/og-card";

export const alt = "ぜんぶナビの定時配信";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

/** X などで配信ページを共有したときの画像。配信した見出しを並べる */
export default async function Image({ params }: { params: Promise<{ date: string; slot: string }> }) {
  const { date, slot: s } = await params;
  const slot = slotFromSlug(s);
  const d = slot && isDate(date) ? await getPublishedDigest(date, slot) : null;
  if (!d) return renderOgCard({ title: "" });
  return renderOgCard({
    title: d.items.map((i) => `・${i.headline}`).join("\n"),
    label: `${d.dateLabel} ${d.title}`,
    note: `大事なニュース${d.items.length}本`,
  });
}
