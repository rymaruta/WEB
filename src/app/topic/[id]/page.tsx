import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiArticleView } from "@/components/ai-article";
import { GenreBadge } from "@/components/genre-badge";
import { GenreIcon } from "@/components/genre-icon";
import { OutboundLink } from "@/components/outbound-link";
import { PublisherAvatars } from "@/components/publisher-avatars";
import { Thumbnail } from "@/components/thumbnail";
import { SectionHeading } from "@/components/section-heading";
import { ShareButtons } from "@/components/share-buttons";
import { siteConfig } from "@/config/site";
import { TopicList } from "@/components/topic-card";
import { readAiArticle } from "@/lib/ai/article";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { getTopic, getTrendingTopics } from "@/lib/queries";
import { newsArticleJsonLd, serializeJsonLd } from "@/lib/structured-data";

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
  const ai = readAiArticle(topic);
  const summary = ai?.lead || (topic.articles.find((a) => a.summary)?.summary ?? undefined);
  const title = ai?.title ?? topic.title;
  return {
    title,
    description: summary,
    alternates: { canonical: `/topic/${topic.id}` },
    // openGraph はレイアウトの値を丸ごと置き換えるため、サイト名と言語もここで指定する
    openGraph: { title, description: summary, type: "article", siteName: siteConfig.name, locale: "ja_JP" },
    // 検索エンジンに登録するのは、独自の文章（AI まとめ記事）があるトピックだけ。
    // 見出しと元記事へのリンクだけのページは付加価値が小さいため登録しない
    robots: ai ? undefined : { index: false, follow: true },
  };
}

export default async function TopicPage({ params }: PageProps<"/topic/[id]">) {
  const id = parseId((await params).id);
  const topic = id ? await getTopic(id) : null;
  if (!topic) notFound();

  const related = await getTrendingTopics({ genreId: topic.genreId, take: 8, excludeIds: [topic.id] });
  const ai = readAiArticle(topic);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="card min-w-0 overflow-hidden">
        {ai && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(newsArticleJsonLd(topic.id, ai, topic.articles.map((a) => ({ url: a.url, publisher: a.publisher })))),
            }}
          />
        )}
        <header
          className="px-5 pt-4 pb-5 sm:px-6"
          style={{ background: `linear-gradient(180deg, color-mix(in oklab, var(--g-${topic.genre.slug}) 14%, var(--surface)), var(--surface))` }}
        >
          <nav aria-label="パンくず" className="mb-3 flex items-center gap-1.5 text-xs text-fg-subtle">
            <Link href="/" className="hover:text-fg">トップ</Link>
            <span>›</span>
            <Link href={`/genre/${topic.genre.slug}`} className="flex items-center gap-1 hover:text-fg">
              <GenreIcon slug={topic.genre.slug} className="h-3.5 w-3.5" />
              {topic.genre.name}
            </Link>
          </nav>
          {/* AI まとめ記事があるときは、その見出しをページの見出しにする（同じ話題の見出しを2回並べない） */}
          <h1 className="text-xl leading-snug font-black sm:text-[26px]">{ai?.title ?? topic.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
            <GenreBadge genre={topic.genre} link />
            {topic.publisherCount > 1 && (
              <span className="flex items-center gap-2">
                <PublisherAvatars names={[...new Set(topic.articles.map((a) => a.publisher))]} max={6} size="md" />
                <span>
                  <strong className="text-lg font-black text-accent tabular-nums">{topic.publisherCount}</strong>媒体・
                  {topic.articleCount}本の記事
                </span>
              </span>
            )}
            <span className="text-xs">
              最初の報道 <time dateTime={topic.firstSeenAt.toISOString()}>{formatDateTime(topic.firstSeenAt)}</time>
              {topic.lastSeenAt > topic.firstSeenAt && (
                <>
                  {" "}／ 最新 <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
                </>
              )}
            </span>
          </div>
        </header>

        <div className="px-5 pb-5 sm:px-6">
          {ai && (
            <div className="mb-6">
              <AiArticleView article={ai} sources={topic.articles.map((a) => ({ id: a.id, publisher: a.publisher }))} showTitle={false} />
              {/* 共有は読み終えた位置に置く（本文より先に並べると、読む前に場所を取る） */}
              <div className="mt-4">
                <ShareButtons title={ai.title} url={`${siteConfig.url}/topic/${topic.id}`} />
              </div>
            </div>
          )}
        <h2 className="mt-2 mb-1 text-sm font-bold text-fg-muted">各媒体の報道（古い順）</h2>
        <ol className="relative border-l-2 border-border pl-5">
          {topic.articles.map((a) => (
            <li key={a.id} className="relative my-3 flex gap-4 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
              <span aria-hidden className="absolute top-5 -left-[27px] h-3 w-3 rounded-full border-2 border-surface bg-accent" />
              <div className="min-w-0 flex-1">
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
              </div>
              {a.imageUrl && (
                <OutboundLink articleId={a.id} className="relative hidden w-36 shrink-0 self-start overflow-hidden rounded-lg sm:block">
                  <Thumbnail src={a.imageUrl} genreSlug={topic.genre.slug} iconClassName="h-6 w-6" className="aspect-[16/9] w-full" sizes="144px" />
                </OutboundLink>
              )}
            </li>
          ))}
        </ol>
        {!ai && (
          <div className="mt-4">
            <ShareButtons title={topic.title} url={`${siteConfig.url}/topic/${topic.id}`} />
          </div>
        )}
        </div>
      </article>

      <aside className="min-w-0">
        <section className="card p-4">
          <SectionHeading title={`${topic.genre.name}の話題`} href={`/genre/${topic.genre.slug}`} genreSlug={topic.genre.slug} />
          <TopicList topics={related} variant="compact" showGenre={false} />
        </section>
      </aside>
    </div>
  );
}
