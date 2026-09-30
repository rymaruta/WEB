import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GenreBadge } from "@/components/genre-badge";
import { OutboundLink } from "@/components/outbound-link";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { getTopic, getTrendingTopics } from "@/lib/queries";

export const revalidate = 60;

/** ビルド時には生成せず、初回アクセス時に生成して ISR でキャッシュする */
export async function generateStaticParams() {
  return [];
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id < 2 ** 31 ? id : null;
}

export async function generateMetadata({ params }: PageProps<"/topic/[id]">): Promise<Metadata> {
  const id = parseId((await params).id);
  const topic = id ? await getTopic(id) : null;
  if (!topic) return {};
  const summary = topic.articles.find((a) => a.summary)?.summary ?? undefined;
  return {
    title: topic.title,
    description: summary,
    alternates: { canonical: `/topic/${topic.id}` },
    openGraph: { title: topic.title, description: summary, type: "article" },
    // 単独記事のトピックは独自の付加価値が小さいため検索エンジンに登録しない
    robots: topic.publisherCount < 2 ? { index: false, follow: true } : undefined,
  };
}

export default async function TopicPage({ params }: PageProps<"/topic/[id]">) {
  const id = parseId((await params).id);
  const topic = id ? await getTopic(id) : null;
  if (!topic) notFound();

  const related = await getTrendingTopics({ genreId: topic.genreId, take: 8, excludeIds: [topic.id] });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="min-w-0 rounded-lg border border-border bg-surface p-4 sm:p-6">
        <nav aria-label="パンくず" className="mb-3 flex items-center gap-1.5 text-xs text-fg-subtle">
          <Link href="/" className="hover:text-fg">トップ</Link>
          <span>›</span>
          <Link href={`/genre/${topic.genre.slug}`} className="hover:text-fg">{topic.genre.name}</Link>
        </nav>
        <h1 className="text-xl leading-snug font-extrabold sm:text-2xl">{topic.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
          <GenreBadge genre={topic.genre} link />
          {topic.publisherCount > 1 && (
            <span className="rounded bg-accent-soft px-1.5 py-px text-xs font-semibold text-accent">
              {topic.publisherCount}媒体・{topic.articleCount}本の記事
            </span>
          )}
          <span>
            最初の報道 <time dateTime={topic.firstSeenAt.toISOString()}>{formatDateTime(topic.firstSeenAt)}</time>
          </span>
          {topic.lastSeenAt > topic.firstSeenAt && (
            <span>
              最新 <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
            </span>
          )}
        </div>

        <h2 className="mt-6 mb-1 text-sm font-bold text-fg-muted">各媒体の報道（古い順）</h2>
        <ol className="relative border-l-2 border-border pl-5">
          {topic.articles.map((a) => (
            <li key={a.id} className="relative py-3">
              <span aria-hidden className="absolute top-[18px] -left-[27px] h-3 w-3 rounded-full border-2 border-surface bg-accent" />
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
                <span className="font-bold text-fg">{a.publisher}</span>
                <time dateTime={a.publishedAt.toISOString()}>{formatDateTime(a.publishedAt)}</time>
                {a.source.kind === "SOCIAL" && a.socialCount > 0 && (
                  <span className="text-accent">はてなブックマーク {formatNumber(a.socialCount)} users</span>
                )}
                {a.source.kind === "PRESS" && <span className="rounded border border-border px-1">プレスリリース</span>}
              </div>
              <OutboundLink articleId={a.id} className="headline mt-0.5 block font-bold leading-snug hover:text-accent hover:underline">
                {a.title}
              </OutboundLink>
              {a.summary && <p className="mt-1 text-sm text-fg-muted">{a.summary}</p>}
              <OutboundLink articleId={a.id} className="mt-1 inline-block text-xs font-semibold text-accent hover:underline">
                {a.publisher}で続きを読む ↗
              </OutboundLink>
            </li>
          ))}
        </ol>
      </article>

      <aside className="min-w-0">
        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading title={`${topic.genre.name}の話題`} href={`/genre/${topic.genre.slug}`} />
          <TopicList topics={related} variant="compact" showGenre={false} />
        </section>
      </aside>
    </div>
  );
}
