import type { Metadata } from "next";
import Link from "next/link";
import { AiArticleView } from "@/components/ai-article";
import { SectionHeading } from "@/components/section-heading";
import { ShareButtons } from "@/components/share-buttons";
import { HeroCarousel } from "@/components/hero-carousel";
import { HeroTopic, TopicList } from "@/components/topic-card";
import { siteConfig } from "@/config/site";
import { readAiArticle } from "@/lib/ai/article";
import { getPinnedTopic, getTopic, getTrendingTopics } from "@/lib/queries";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "いま話題のニュース",
  description: "いちばん大きな話題を、複数の媒体の報道からまとめた記事で詳しく。いま多くの媒体が報じているニュースも一覧で。",
  alternates: { canonical: "/trending" },
};

/**
 * 「話題」タブ。いちばん大きな出来事（運営者が固定した話題、なければ話題度1位のまとめ記事がある話題）を、
 * まとめ記事ごと大きく載せ、その下に、いま多くの媒体が報じている話題を並べる
 */
export default async function TrendingPage() {
  const [pinned, trending] = await Promise.all([getPinnedTopic().catch(() => null), getTrendingTopics({ minPublishers: 2, take: 21 })]);
  const leadId = pinned?.id ?? trending.find((t) => t.aiGeneratedAt)?.id ?? trending[0]?.id;
  const lead = leadId ? await getTopic(leadId) : null;
  const card = pinned ?? trending.find((t) => t.id === leadId) ?? null;
  const ai = lead ? readAiArticle(lead) : null;
  // 横にスライドして見られる大きな枠：いちばん大きな話題と、まとめ記事のある話題を合わせて5本まで
  const slides = trending.filter((t) => t.id !== leadId && t.aiGeneratedAt).slice(0, 4);
  const slideIds = new Set([leadId, ...slides.map((t) => t.id)]);
  const others = trending.filter((t) => !slideIds.has(t.id)).slice(0, 20);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">いま話題のニュース</h1>
        <p className="mt-1 text-sm text-fg-muted">いちばん大きな話題を、複数の媒体の報道からまとめた記事で詳しく伝えます。</p>
      </header>

      {lead && card && (
        <article aria-label="いちばん大きな話題" className="space-y-4">
          {pinned && <p className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-black text-accent-fg">注目のニュース</p>}
          <HeroCarousel label="大きな話題">
            <HeroTopic topic={card} label={pinned ? "注目のニュース" : "いちばんの話題"} />
            {slides.map((t, i) => (
              <HeroTopic key={t.id} topic={t} priority={false} label={`話題 ${i + 2}`} />
            ))}
          </HeroCarousel>
          {ai && <p className="pt-1 text-xs font-bold text-fg-muted">いちばん大きな話題のまとめ記事</p>}
          {ai && (
            <>
              <AiArticleView article={ai} sources={lead.articles.map((a) => ({ id: a.id, publisher: a.publisher }))} />
              <ShareButtons title={ai.title} url={`${siteConfig.url}/topic/${lead.id}`} />
            </>
          )}
          <Link href={`/topic/${lead.id}`} className="block rounded-lg border border-border px-4 py-3 text-center text-sm font-bold hover:border-accent hover:text-accent">
            各媒体の報道・これまでの経緯をくわしく見る →
          </Link>
        </article>
      )}

      <section className="card px-4 pt-4">
        <SectionHeading title="ほかの話題" href="/ranking" moreLabel="ランキング" />
        <TopicList topics={others} ranked />
      </section>
    </div>
  );
}
