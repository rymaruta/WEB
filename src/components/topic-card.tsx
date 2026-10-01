import Link from "next/link";
import type { ReactNode } from "react";
import { relativeTime } from "@/lib/format";
import type { TopicCardData } from "@/lib/queries";
import { GenreBadge } from "./genre-badge";
import { OutboundLink } from "./outbound-link";
import { PublisherAvatars } from "./publisher-avatars";
import { RankBadge } from "./rank-badge";
import { Thumbnail } from "./thumbnail";

type Variant = "standard" | "compact";

/** 代表記事・要約・媒体一覧など、カード表示に必要な値を取り出す */
function describe(topic: TopicCardData) {
  const primary = topic.articles.filter((a) => a.source.kind !== "SOCIAL");
  const lead = primary[0] ?? topic.articles[0];
  const summary =
    topic.aiLead || ((primary.find((a) => a.summary) ?? topic.articles.find((a) => a.summary))?.summary ?? null);
  const publishers = [...new Set(topic.articles.map((a) => a.publisher))];
  const image = (primary.find((a) => a.imageUrl) ?? topic.articles.find((a) => a.imageUrl))?.imageUrl ?? null;
  // AI まとめ記事があれば、その見出し（当サイト独自の見出し）を表示する
  const title = topic.aiTitle || topic.title;
  return { lead, title, summary, publishers, image, hasAi: Boolean(topic.aiGeneratedAt), multi: topic.articleCount > 1 };
}

/** 複数記事のトピックはトピックページへ、単独記事は元記事へ直接リンクする */
function TopicLink({ topic, leadId, className, children }: { topic: TopicCardData; leadId: number; className?: string; children: ReactNode }) {
  return topic.articleCount > 1 ? (
    <Link href={`/topic/${topic.id}`} className={className}>
      {children}
    </Link>
  ) : (
    <OutboundLink articleId={leadId} className={className}>
      {children}
    </OutboundLink>
  );
}

function PublisherLine({ publishers, max }: { publishers: string[]; max: number }) {
  return (
    <span className="truncate">
      {publishers.slice(0, max).join("・")}
      {publishers.length > max && ` ほか${publishers.length - max}`}
    </span>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-accent px-2 py-px text-[11px] font-bold text-accent-fg">
      AIまとめ
    </span>
  );
}

function CoverageBadge({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-px text-[11px] font-bold text-accent">
      {count}媒体が報道
    </span>
  );
}

/** トップの一番大きな枠。ジャンル色のパネルに報道媒体数を大きく示す */
export function HeroTopic({ topic }: { topic: TopicCardData }) {
  const { lead, title, summary, publishers, image, hasAi } = describe(topic);
  if (!lead) return null;
  return (
    <article className="card group grid overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <TopicLink topic={topic} leadId={lead.id} className="relative block aspect-[16/9] overflow-hidden md:aspect-auto md:min-h-72">
        <Thumbnail
          src={image}
          genreSlug={topic.genre.slug}
          priority
          sizes="(max-width: 1024px) 100vw, 800px"
          iconClassName="h-16 w-16"
          className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 flex items-end gap-3 p-4 text-white">
          {topic.publisherCount > 1 && (
            <p className="leading-none drop-shadow">
              <span className="text-5xl font-black tabular-nums">{topic.publisherCount}</span>
              <span className="ml-1 text-sm font-bold">媒体が報道</span>
            </p>
          )}
        </div>
        <span className="absolute top-3 left-3">
          <GenreBadge genre={topic.genre} />
        </span>
      </TopicLink>
      <div className="flex min-w-0 flex-col p-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold text-accent">
          トップニュース{hasAi && <AiBadge />}
        </p>
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <h2 className="text-xl leading-snug font-black group-hover:text-accent sm:text-2xl">{title}</h2>
        </TopicLink>
        {summary && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-fg-muted">{summary}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs text-fg-subtle">
          <PublisherAvatars names={publishers} size="md" />
          <PublisherLine publishers={publishers} max={3} />
          <time dateTime={topic.lastSeenAt.toISOString()} className="ml-auto">{relativeTime(topic.lastSeenAt)}</time>
        </div>
      </div>
    </article>
  );
}

/** 2列に並べる中サイズのカード */
export function TopicTile({ topic }: { topic: TopicCardData }) {
  const { lead, title, summary, publishers, image, hasAi } = describe(topic);
  if (!lead) return null;
  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <TopicLink topic={topic} leadId={lead.id} className="relative block aspect-[16/9] overflow-hidden">
        <Thumbnail
          src={image}
          genreSlug={topic.genre.slug}
          className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <GenreBadge genre={topic.genre} />
          {hasAi && <AiBadge />}
          {topic.publisherCount > 1 && (
            <span className="rounded-full bg-black/60 px-2 py-px text-[11px] font-bold text-white backdrop-blur">
              {topic.publisherCount}媒体が報道
            </span>
          )}
        </span>
      </TopicLink>
      <div className="flex flex-1 flex-col p-4">
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <h3 className="leading-snug font-bold group-hover:text-accent">{title}</h3>
        </TopicLink>
        {summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-fg-muted">{summary}</p>}
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-fg-subtle">
          <PublisherAvatars names={publishers} max={4} />
          <PublisherLine publishers={publishers} max={2} />
          <time dateTime={topic.lastSeenAt.toISOString()} className="ml-auto shrink-0">{relativeTime(topic.lastSeenAt)}</time>
        </div>
      </div>
    </article>
  );
}

type CardProps = { topic: TopicCardData; variant?: Variant; showGenre?: boolean; rank?: number };

/** 一覧の1行 */
export function TopicCard({ topic, variant = "standard", showGenre = true, rank }: CardProps) {
  const { lead, title, summary, publishers, image, hasAi } = describe(topic);
  if (!lead) return null;
  const compact = variant === "compact";
  return (
    <article className={`group flex gap-3 ${compact ? "py-2.5" : "py-3.5"}`}>
      {rank !== undefined && <RankBadge rank={rank} size="md" />}
      <div className="min-w-0 flex-1">
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <span className={`${compact ? "text-sm font-medium" : "text-[15px] font-bold"} leading-snug group-hover:text-accent`}>
            {title}
          </span>
        </TopicLink>
        {!compact && summary && <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{summary}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          {showGenre && <GenreBadge genre={topic.genre} />}
          {hasAi && <AiBadge />}
          <CoverageBadge count={topic.publisherCount} />
          {topic.publisherCount > 1 && !compact && <PublisherAvatars names={publishers} max={4} />}
          <PublisherLine publishers={publishers} max={compact ? 2 : 3} />
          <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
        </div>
      </div>
      {!compact && (
        <TopicLink topic={topic} leadId={lead.id} className="relative block h-[72px] w-24 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-32">
          <Thumbnail src={image} genreSlug={topic.genre.slug} iconClassName="h-6 w-6" className="absolute inset-0 h-full w-full" />
        </TopicLink>
      )}
    </article>
  );
}

export function TopicList({
  topics,
  variant,
  showGenre,
  ranked = false,
  emptyText = "該当するニュースはまだありません。",
}: {
  topics: TopicCardData[];
  variant?: Variant;
  showGenre?: boolean;
  ranked?: boolean;
  emptyText?: string;
}) {
  if (topics.length === 0) return <p className="py-6 text-sm text-fg-subtle">{emptyText}</p>;
  return (
    <div className="divide-y divide-border">
      {topics.map((t, i) => (
        <TopicCard key={t.id} topic={t} variant={variant} showGenre={showGenre} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  );
}
