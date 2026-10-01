import { readAiArticle } from "@/lib/ai/article";
import { OG_SIZE, renderOgCard } from "@/lib/og-card";
import { getTopic } from "@/lib/queries";

export const alt = "ニュースのトピック";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const topic = Number.isInteger(id) && id > 0 && id < 2 ** 31 ? await getTopic(id) : null;
  if (!topic) return renderOgCard({ title: "" });
  const ai = readAiArticle(topic);
  return renderOgCard({
    title: ai?.title ?? topic.title,
    label: topic.genre.name,
    genreSlug: topic.genre.slug,
    note: topic.publisherCount > 1 ? `${topic.publisherCount}媒体が報道` : undefined,
  });
}
