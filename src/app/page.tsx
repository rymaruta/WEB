import { ArticleRanking } from "@/components/article-ranking";
import { DigestSummaryCard } from "@/components/digest-summary";
import { SectionHeading } from "@/components/section-heading";
import { HeroTopic, TopicCard, TopicList, TopicTile } from "@/components/topic-card";
import { getLatestDigest } from "@/lib/digest/latest";
import { formatNumber } from "@/lib/format";
import { getGenres, getLatestArticles, getMostRead, getSiteStats, getSocialBuzz, getTrendingTopics } from "@/lib/queries";

export const revalidate = 60;

/** 一番上の大きな枠に優先して置くジャンル（多くの読者に関わる出来事） */
const HERO_GENRES = new Set(["domestic", "world", "business", "tech"]);

export default async function HomePage() {
  const [genres, headline, mostRead, buzz, latest, stats, digest] = await Promise.all([
    getGenres(),
    getTrendingTopics({ minPublishers: 2, take: 11 }),
    getMostRead(8),
    getSocialBuzz(8),
    getLatestArticles(8),
    getSiteStats(),
    // 配信の失敗でトップ全体を止めない
    getLatestDigest().catch(() => null),
  ]);

  const headlineIds = headline.map((t) => t.id);
  const sections = await Promise.all(
    genres.map(async (genre) => ({
      genre,
      topics: await getTrendingTopics({ genreId: genre.id, take: 6, excludeIds: headlineIds }),
    })),
  );

  // 一番上は、まとめ記事があり、多くの読者に関わるジャンルの話題を優先する（なければ話題度の1位）
  const lead = headline.find((t) => t.aiTitle && HERO_GENRES.has(t.genre.slug)) ?? headline[0];
  const others = headline.filter((t) => t !== lead);
  const tiles = others.slice(0, 4);
  const rest = others.slice(4);

  return (
    <div className="space-y-10">
      {/* X で配信した最新の回（朝・昼・夜のニュース）。X から来た人が同じ形で続きを読めるように一番上に置く */}
      {digest && <DigestSummaryCard digest={digest} />}
      <section aria-labelledby="trending">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 id="trending" className="text-2xl font-black tracking-tight">いま話題のニュース</h1>
            <p className="mt-0.5 text-xs text-fg-subtle">複数の媒体が報じている出来事を、話題の大きさ順にまとめています。</p>
          </div>
          <p className="flex gap-4 text-xs text-fg-muted">
            <span>
              直近24時間 <strong className="text-base font-black text-fg tabular-nums">{formatNumber(stats.articles24h)}</strong> 件
            </span>
            <span>
              <strong className="text-base font-black text-fg tabular-nums">{stats.publishers}</strong> 媒体から収集
            </span>
          </p>
        </div>

        {lead ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-4">
              <HeroTopic topic={lead} />
              {/* スマホではサイドバーが一番下になるため、ランキングをトップ記事の直後に出す */}
              <section className="card p-4 lg:hidden">
                {mostRead.length > 0 ? (
                  <>
                    <SectionHeading title="よく読まれている" href="/ranking" moreLabel="ランキング" />
                    <ArticleRanking items={mostRead.slice(0, 5)} metric="clicks" />
                  </>
                ) : (
                  <>
                    <SectionHeading title="SNSで話題" note="はてなブックマーク数" href="/ranking" moreLabel="ランキング" />
                    <ArticleRanking items={buzz.slice(0, 5)} metric="social" showGenre />
                  </>
                )}
              </section>
              <div className="grid gap-4 sm:grid-cols-2">
                {tiles.map((t) => (
                  <TopicTile key={t.id} topic={t} />
                ))}
              </div>
              {rest.length > 0 && (
                <div className="card divide-y divide-border px-4">
                  {rest.map((t) => (
                    <TopicCard key={t.id} topic={t} />
                  ))}
                </div>
              )}
            </div>
            <aside className="min-w-0 space-y-6">
              {mostRead.length > 0 && (
                <section className="card hidden p-4 lg:block">
                  <SectionHeading title="よく読まれている" href="/ranking" moreLabel="ランキング" />
                  <ArticleRanking items={mostRead} metric="clicks" />
                </section>
              )}
              <section className="card p-4">
                <SectionHeading title="SNSで話題" note="はてなブックマーク数" href="/ranking" moreLabel="ランキング" />
                <ArticleRanking items={buzz} metric="social" showGenre />
              </section>
              <section className="card p-4">
                <SectionHeading title="新着" />
                <ArticleRanking items={latest} showGenre />
              </section>
            </aside>
          </div>
        ) : (
          <p className="card p-6 text-sm text-fg-subtle">ニュースを準備しています。しばらくしてから再度お越しください。</p>
        )}
      </section>

      <section aria-labelledby="by-genre">
        <h2 id="by-genre" className="mb-4 text-xl font-black tracking-tight">ジャンル別ニュース</h2>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sections.map(({ genre, topics }) => {
            const [top, ...more] = topics;
            return (
              <section key={genre.id} aria-label={genre.name} className="card flex min-w-0 flex-col p-4">
                <SectionHeading title={genre.name} href={`/genre/${genre.slug}`} genreSlug={genre.slug} />
                {top ? (
                  <>
                    <div className="border-b border-border">
                      <TopicCard topic={top} showGenre={false} />
                    </div>
                    <TopicList topics={more.slice(0, 2)} variant="compact" showGenre={false} />
                    {/* スマホでは各ジャンル3本までにして、トップが縦に長くなりすぎないようにする */}
                    {more.length > 2 && (
                      <div className="hidden border-t border-border md:block">
                        <TopicList topics={more.slice(2)} variant="compact" showGenre={false} />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="py-6 text-sm text-fg-subtle">直近のニュースはありません。</p>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
