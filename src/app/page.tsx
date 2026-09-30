import { ArticleRanking } from "@/components/article-ranking";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import { formatNumber } from "@/lib/format";
import {
  getGenres,
  getLatestArticles,
  getMostRead,
  getSiteStats,
  getSocialBuzz,
  getTrendingTopics,
} from "@/lib/queries";

export const revalidate = 60;

export default async function HomePage() {
  const [genres, headline, mostRead, buzz, latest, stats] = await Promise.all([
    getGenres(),
    getTrendingTopics({ minPublishers: 2, take: 8 }),
    getMostRead(10),
    getSocialBuzz(10),
    getLatestArticles(10),
    getSiteStats(),
  ]);

  const headlineIds = headline.map((t) => t.id);
  const sections = await Promise.all(
    genres.map(async (genre) => ({
      genre,
      topics: await getTrendingTopics({ genreId: genre.id, take: 5, excludeIds: headlineIds }),
    })),
  );

  const [lead, ...rest] = headline;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-8">
        <section aria-labelledby="trending" className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h1 id="trending" className="flex items-center gap-2 text-lg font-extrabold">
              <span aria-hidden className="h-4 w-1 rounded-full bg-accent" />
              いま話題のニュース
            </h1>
            <p className="text-xs text-fg-subtle">
              直近24時間 {formatNumber(stats.articles24h)}件・{stats.publishers}媒体から
            </p>
          </div>
          <p className="mb-2 text-xs text-fg-subtle">複数の媒体が報じている出来事を、話題の大きさ順にまとめています。</p>
          {lead ? (
            <>
              <TopicList topics={[lead]} variant="feature" />
              <div className="border-t border-border">
                <TopicList topics={rest} variant="standard" />
              </div>
            </>
          ) : (
            <p className="py-6 text-sm text-fg-subtle">まだニュースを収集していません。`npm run crawl` を実行してください。</p>
          )}
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          {sections.map(({ genre, topics }) => (
            <section key={genre.id} aria-label={genre.name} className="min-w-0">
              <SectionHeading title={genre.name} href={`/genre/${genre.slug}`} accent={`var(--g-${genre.slug})`} />
              <TopicList topics={topics} variant="compact" showGenre={false} />
            </section>
          ))}
        </div>
      </div>

      <aside className="min-w-0 space-y-8">
        {mostRead.length > 0 && (
          <section className="rounded-lg border border-border bg-surface p-4">
            <SectionHeading title="よく読まれている" href="/ranking" moreLabel="ランキング" />
            <ArticleRanking items={mostRead} metric="clicks" />
          </section>
        )}
        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading title="SNSで話題" href="/ranking" moreLabel="ランキング" />
          <ArticleRanking items={buzz} metric="social" showGenre />
        </section>
        <section className="rounded-lg border border-border bg-surface p-4">
          <SectionHeading title="新着" />
          <ArticleRanking items={latest} showGenre />
        </section>
      </aside>
    </div>
  );
}
