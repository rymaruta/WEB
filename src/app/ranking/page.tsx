import type { Metadata } from "next";
import { ArticleRanking } from "@/components/article-ranking";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import { getMostRead, getSocialBuzz, getTrendingTopics, TRENDING_HOURS } from "@/lib/queries";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ニュースランキング",
  description: "いま多くの媒体が報じているニュース、よく読まれている記事、SNSで話題の記事のランキング。",
  alternates: { canonical: "/ranking" },
};

export default async function RankingPage() {
  const [topics, mostRead, buzz] = await Promise.all([
    getTrendingTopics({ minPublishers: 2, take: 20 }),
    getMostRead(20),
    getSocialBuzz(20),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ランキング</h1>
      <p className="text-sm text-fg-muted">直近{TRENDING_HOURS}時間のニュースが対象です。</p>
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="min-w-0 card p-4">
          <SectionHeading title="話題のトピック" />
          <p className="mb-2 text-xs text-fg-subtle">報じた媒体数・SNSでの反応・閲覧数と新しさから算出</p>
          <TopicList topics={topics} variant="compact" ranked />
        </section>
        <section className="min-w-0 card p-4">
          <SectionHeading title="よく読まれている記事" />
          <p className="mb-2 text-xs text-fg-subtle">{"このサイトから元記事が開かれた回数"}</p>
          <ArticleRanking items={mostRead} metric="clicks" showGenre emptyText="集計中です。記事が読まれるとここに表示されます。" />
        </section>
        <section className="min-w-0 card p-4">
          <SectionHeading title="SNSで話題" />
          <p className="mb-2 text-xs text-fg-subtle">はてなブックマーク数</p>
          <ArticleRanking items={buzz} metric="social" showGenre />
        </section>
      </div>
    </div>
  );
}
