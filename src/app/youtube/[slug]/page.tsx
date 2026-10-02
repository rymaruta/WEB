import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow-button";
import { GroupTabs } from "@/components/group-tabs";
import { TopicList } from "@/components/topic-card";
import { VideoGrid } from "@/components/youtube/video-card";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { findChannel, getChannelNews, getChannelVideos } from "@/lib/youtube";

export const revalidate = 900;

export async function generateMetadata({ params }: PageProps<"/youtube/[slug]">): Promise<Metadata> {
  const c = findChannel((await params).slug);
  if (!c) return {};
  return {
    title: `${c.name}の最新動画とニュース`,
    description: `${c.name}の YouTube の最新動画（再生回数つき）と、${c.name}に関するニュースをまとめています。`,
    alternates: { canonical: `/youtube/${c.slug}` },
  };
}

export default async function ChannelPage({ params }: PageProps<"/youtube/[slug]">) {
  const c = findChannel((await params).slug);
  if (!c) notFound();
  const [videos, news] = await Promise.all([getChannelVideos(c.id, 60), getChannelNews(c, 20)]);
  const long = videos.filter((v) => !v.isShort);
  const shorts = videos.filter((v) => v.isShort);
  const follow = c.keywords.split("|")[0];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "YouTube 新着動画", path: "/youtube" },
              { name: c.name, path: `/youtube/${c.slug}` },
            ]),
          ),
        }}
      />
      <header className="card p-5 sm:p-6">
        <nav aria-label="パンくず" className="mb-2 text-xs text-fg-subtle">
          <Link href="/youtube" className="hover:text-fg">
            YouTube 新着動画
          </Link>
        </nav>
        <h1 className="text-2xl font-black">{c.name}</h1>
        <p className="mt-2 text-sm text-fg-muted">最新動画と、{c.name}に関するニュースをまとめています。</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FollowButton follow={{ kind: "word", key: follow, label: follow }} />
          <a
            href={`https://www.youtube.com/channel/${c.id}`}
            target="_blank"
            rel="noopener nofollow"
            className="rounded-full border border-border px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent"
          >
            YouTube のチャンネルを開く ↗
          </a>
        </div>
      </header>
      <section className="card p-4 sm:p-5" aria-label="動画">
        <GroupTabs
          id={`yt-${c.slug}`}
          label="動画の種類"
          groups={[
            { key: "videos", label: "動画", note: String(long.length), content: long.length ? <VideoGrid videos={long} showChannel={false} /> : <p className="py-4 text-sm text-fg-subtle">まだありません</p> },
            { key: "shorts", label: "ショート", note: String(shorts.length), content: shorts.length ? <VideoGrid videos={shorts} showChannel={false} /> : <p className="py-4 text-sm text-fg-subtle">まだありません</p> },
          ]}
        />
      </section>
      {news.length > 0 && (
        <section className="card px-4 sm:px-5">
          <h2 className="pt-4 text-lg font-black">{c.name}のニュース</h2>
          <TopicList topics={news} showGenre={false} />
        </section>
      )}
      <p className="text-xs leading-relaxed text-fg-subtle">動画の情報は、YouTube が公開しているチャンネルの新着情報をもとに自動でまとめています。このサイトはチャンネルの公式ページではありません。</p>
    </div>
  );
}
