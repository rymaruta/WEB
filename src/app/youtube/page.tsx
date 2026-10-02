import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/section-heading";
import { TopicList } from "@/components/topic-card";
import { VideoCard, VideoGrid } from "@/components/youtube/video-card";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { GroupTabs } from "@/components/group-tabs";
import {
  getChannelNews,
  getChannelVideos,
  getPopularVideos,
  getRisingVideos,
  getVideosByCategory,
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABELS,
  viewsLabel,
  YOUTUBE_CHANNELS,
} from "@/lib/youtube";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "YouTube 新着動画｜ヒカキン・はじめしゃちょーの最新動画と伸びている動画",
  description: "HIKAKIN（HikakinTV）・はじめしゃちょーの最新動画、いま再生数が伸びている動画、YouTuber に関するニュースを1ページにまとめています。",
  alternates: { canonical: "/youtube" },
};

export default async function YouTubePage() {
  const [rising, popular, byCategory, channels] = await Promise.all([
    getRisingVideos(5),
    getPopularVideos(6),
    getVideosByCategory(6),
    Promise.all(
      YOUTUBE_CHANNELS.map(async (c) => ({
        c,
        videos: (await getChannelVideos(c.id, 30)).filter((v) => !v.isShort).slice(0, 4),
        news: await getChannelNews(c, 5),
      })),
    ),
  ]);
  const news = channels
    .flatMap((x) => x.news)
    .filter((t, i, all) => all.findIndex((u) => u.id === t.id) === i)
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "YouTube 新着動画", path: "/youtube" },
            ]),
          ),
        }}
      />
      <header className="card p-5 sm:p-6">
        <h1 className="text-2xl font-black">YouTube 新着動画</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">人気 YouTuber の最新動画と、いま再生数が伸びている動画、YouTuber に関するニュースをまとめています。</p>
        <nav aria-label="チャンネル" className="mt-3 flex flex-wrap gap-2">
          {YOUTUBE_CHANNELS.map((c) => (
            <Link key={c.slug} href={`/youtube/${c.slug}`} prefetch={false} className="rounded-full border border-border px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent">
              {c.name}
            </Link>
          ))}
        </nav>
      </header>

      {rising.length > 0 && (
        <section className="card p-4 sm:p-5" aria-labelledby="yt-rising">
          <h2 id="yt-rising" className="mb-3 text-lg font-black">
            いま伸びている動画
            <span className="ml-2 text-xs font-bold text-fg-subtle">この1日で増えた再生回数</span>
          </h2>
          <ol className="space-y-3">
            {rising.map((v, i) => (
              <li key={v.videoId} className="flex gap-3">
                <span className="w-5 shrink-0 pt-1 text-center text-sm font-black text-accent tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <VideoCard v={v} note={v.gain > 0 ? `+${viewsLabel(v.gain)}` : undefined} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {popular.length > 0 && (
        <section className="card p-4 sm:p-5" aria-labelledby="yt-popular">
          <h2 id="yt-popular" className="mb-3 text-lg font-black">
            人気の動画
            <span className="ml-2 text-xs font-bold text-fg-subtle">この30日に公開された動画の再生回数順</span>
          </h2>
          <VideoGrid videos={popular} />
        </section>
      )}

      {byCategory.size > 0 && (
        <section className="card p-4 sm:p-5" aria-labelledby="yt-genre">
          <h2 id="yt-genre" className="mb-3 text-lg font-black">
            ジャンル別
          </h2>
          <GroupTabs
            id="yt-genre"
            label="動画のジャンル"
            groups={VIDEO_CATEGORIES.filter((k) => byCategory.has(k)).map((k) => ({
              key: k,
              label: VIDEO_CATEGORY_LABELS[k],
              content: <VideoGrid videos={byCategory.get(k)!} />,
            }))}
          />
        </section>
      )}

      {channels.map(({ c, videos }) => (
        <section key={c.slug} className="card p-4 sm:p-5">
          <SectionHeading title={c.name} href={`/youtube/${c.slug}`} moreLabel="すべての動画" />
          {videos.length ? <VideoGrid videos={videos} showChannel={false} /> : <p className="py-4 text-sm text-fg-subtle">動画を取り込んでいます。しばらくお待ちください。</p>}
        </section>
      ))}

      {news.length > 0 && (
        <section className="card px-4 sm:px-5">
          <h2 className="pt-4 text-lg font-black">YouTuber のニュース</h2>
          <TopicList topics={news} showGenre={false} />
        </section>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        動画の情報は、YouTube が公開している各チャンネルの新着情報をもとに自動でまとめています（このサイトは各チャンネルの公式ページではありません）。動画は YouTube
        の埋め込みプレーヤーで再生します。
      </p>
    </div>
  );
}
