import type { Metadata } from "next";
import { ArticleRanking } from "@/components/article-ranking";
import { SectionHeading } from "@/components/section-heading";
import { RisingList } from "@/components/rising-list";
import { TopicList } from "@/components/topic-card";
import { getMostRead, getRisingTopics, getSocialBuzz, getTrendingTopics, TRENDING_HOURS } from "@/lib/queries";

/** 急上昇の対象期間。報道が少ない時間帯（深夜・早朝）に3件に満たなければ、順に広げる */
const RISING_HOURS = [3, 6, 12];
const RISING_MIN_ITEMS = 3;

/** 急上昇：直近3時間で足りなければ6時間、12時間と広げる。使った時間も返す */
async function loadRising() {
  let last = { hours: RISING_HOURS[0], items: [] as Awaited<ReturnType<typeof getRisingTopics>> };
  for (const hours of RISING_HOURS) {
    last = { hours, items: await getRisingTopics(hours, 10) };
    if (last.items.length >= RISING_MIN_ITEMS) break;
  }
  return last;
}

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ニュースランキング",
  description: "いま急上昇しているニュース、多くの媒体が報じているニュース、よく読まれている記事、SNSで話題の記事のランキング。",
  alternates: { canonical: "/ranking" },
};

export default async function RankingPage() {
  const [rising, topics, mostRead, buzz] = await Promise.all([
    loadRising(),
    getTrendingTopics({ minPublishers: 2, take: 20 }),
    getMostRead(20),
    getSocialBuzz(20),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">ランキング</h1>
      <section className="card p-4">
        <SectionHeading title={`急上昇（直近${rising.hours}時間）`} />
        <p className="mb-1 text-xs text-fg-subtle">いま報じる媒体が急に増えている話題。同じ出来事は1件にまとめ、1つのジャンルに偏らないように並べています</p>
        <RisingList items={rising.items} hours={rising.hours} />
      </section>
      <p className="text-sm text-fg-muted">ここから下は、直近{TRENDING_HOURS}時間のニュースが対象です。</p>
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
