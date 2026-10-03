import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { TopicList } from "@/components/topic-card";
import { VideoGrid } from "@/components/youtube/video-card";
import { YouTubePlayer } from "@/components/youtube/player";
import { formatDateTime } from "@/lib/format";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { channelOf, getChannelNews, getChannelVideos, getVideo, videoPath, viewsLabel, youtubeWatchUrl } from "@/lib/youtube";

export const revalidate = 1800;

/** 説明文の冒頭（リンク・ハッシュタグ・宣伝の行を除いて、短く引用する） */
function descriptionExcerpt(d: string): string {
  const lines = d
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/https?:\/\/|^#|^[-=_*]{3,}|Twitter|Instagram|TikTok|メンバーシップ|お仕事|お問い合わせ/i.test(l));
  const text = lines.join(" ");
  return [...text].length > 160 ? `${[...text].slice(0, 160).join("")}…` : text;
}

export async function generateMetadata({ params }: PageProps<"/youtube/v/[id]">): Promise<Metadata> {
  const v = await getVideo((await params).id);
  if (!v) return {};
  const c = channelOf(v);
  return {
    title: `${v.title}｜${c?.name ?? "YouTube"}の動画`,
    description: (v.aiSummary ?? `${c?.name ?? ""}の YouTube 動画「${v.title}」。再生回数と、関連するニュースをまとめています。`).slice(0, 160),
    alternates: { canonical: videoPath(v.videoId) },
    // 動画そのものは他サイトのものなので、検索エンジンには出さない（独自の内容が少ないページを登録しない。AdSense の審査のため）
    robots: { index: false, follow: true },
  };
}

export default async function VideoPage({ params }: PageProps<"/youtube/v/[id]">) {
  const v = await getVideo((await params).id);
  if (!v) notFound();
  const c = channelOf(v);
  const [more, news] = await Promise.all([
    c ? getChannelVideos(c.id, 8).then((l) => l.filter((x) => x.videoId !== v.videoId && x.isShort === v.isShort).slice(0, 6)) : [],
    c ? getChannelNews(c, 3) : [],
  ]);
  const excerpt = descriptionExcerpt(v.description);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            {
              "@context": "https://schema.org",
              "@type": "VideoObject",
              name: v.title,
              description: v.aiSummary ?? v.title,
              thumbnailUrl: [v.thumbnail],
              uploadDate: v.publishedAt.toISOString(),
              embedUrl: `https://www.youtube.com/embed/${v.videoId}`,
              url: `${siteConfig.url}${videoPath(v.videoId)}`,
              interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "WatchAction" }, userInteractionCount: v.views },
            },
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "YouTube 新着動画", path: "/youtube" },
              ...(c ? [{ name: c.name, path: `/youtube/${c.slug}` }] : []),
              { name: v.title, path: videoPath(v.videoId) },
            ]),
          ]),
        }}
      />
      <article className="card p-4 sm:p-6">
        <nav aria-label="パンくず" className="mb-2 text-xs text-fg-subtle">
          <Link href="/youtube" className="hover:text-fg">
            YouTube 新着動画
          </Link>
          {c && (
            <>
              <span className="mx-1">›</span>
              <Link href={`/youtube/${c.slug}`} className="hover:text-fg">
                {c.name}
              </Link>
            </>
          )}
        </nav>
        <YouTubePlayer videoId={v.videoId} title={v.title} thumbnail={v.thumbnail} isShort={v.isShort} />
        <h1 className="mt-4 text-xl leading-snug font-black">{v.title}</h1>
        <p className="mt-1 text-xs text-fg-subtle">
          {c?.name}・{formatDateTime(v.publishedAt)}公開・{viewsLabel(v.views)}再生
        </p>
        {v.aiSummary && (
          <section aria-labelledby="video-summary" className="mt-4 rounded-lg bg-surface-muted p-4">
            <h2 id="video-summary" className="text-xs font-bold text-fg-muted">
              どんな動画？
            </h2>
            <p className="mt-1 leading-relaxed">{v.aiSummary}</p>
            <p className="mt-2 text-[11px] text-fg-subtle">題名と説明文をもとに AI（Claude）が書いた紹介です。動画の内容は YouTube でご確認ください。</p>
          </section>
        )}
        {excerpt && (
          <section className="mt-4">
            <h2 className="text-xs font-bold text-fg-muted">説明文（冒頭）</h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{excerpt}</p>
          </section>
        )}
        <a
          href={youtubeWatchUrl(v.videoId, v.isShort)}
          target="_blank"
          rel="noopener nofollow"
          className="mt-4 inline-block rounded-full border border-border px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent"
        >
          YouTube で見る ↗
        </a>
      </article>
      {more.length > 0 && c && (
        <section className="card p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-black">{c.name}のほかの動画</h2>
          <VideoGrid videos={more} showChannel={false} />
        </section>
      )}
      {news.length > 0 && c && (
        <section className="card px-4 sm:px-5">
          <h2 className="pt-4 text-lg font-black">{c.name}のニュース</h2>
          <TopicList topics={news} showGenre={false} />
        </section>
      )}
    </div>
  );
}
