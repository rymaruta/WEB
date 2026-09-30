import Link from "next/link";
import type { ReactNode } from "react";
import { relativeTime } from "@/lib/format";
import type { TopicCardData } from "@/lib/queries";
import { GenreBadge } from "./genre-badge";
import { GenreIcon } from "./genre-icon";
import { OutboundLink } from "./outbound-link";
import { PublisherAvatars } from "./publisher-avatars";

type Variant = "standard" | "compact";

/** 代表記事・要約・媒体一覧など、カード表示に必要な値を取り出す */
function describe(topic: TopicCardData) {
  const primary = topic.articles.filter((a) => a.source.kind !== "SOCIAL");
  const lead = primary[0] ?? topic.articles[0];
  const summary = (primary.find((a) => a.summary) ?? topic.articles.find((a) => a.summary))?.summary ?? null;
  const publishers = [...new Set(topic.articles.map((a) => a.publisher))];
  return { lead, summary, publishers, multi: topic.articleCount > 1 };
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
  const { lead, summary, publishers } = describe(topic);
  if (!lead) return null;
  const color = `var(--g-${topic.genre.slug})`;
  return (
    <article className="card group grid overflow-hidden sm:grid-cols-[200px_minmax(0,1fr)]">
      <div
        className="relative flex flex-row items-center gap-4 p-5 text-white sm:flex-col sm:items-start sm:justify-between"
        style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, #000))` }}
      >
        <GenreIcon slug={topic.genre.slug} className="h-10 w-10 opacity-90 sm:h-12 sm:w-12" />
        <div>
          <p className="text-xs font-bold tracking-wider opacity-90">{topic.genre.name}</p>
          {topic.publisherCount > 1 && (
            <p className="leading-none">
              <span className="text-5xl font-black tabular-nums">{topic.publisherCount}</span>
              <span className="ml-1 text-sm font-bold">媒体が報道</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col p-5">
        <p className="mb-2 text-xs font-bold text-accent">トップニュース</p>
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <h2 className="text-xl leading-snug font-black group-hover:text-accent sm:text-2xl">{topic.title}</h2>
        </TopicLink>
        {summary && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-fg-muted">{summary}</p>}
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
  const { lead, summary, publishers } = describe(topic);
  if (!lead) return null;
  return (
    <article
      className="card group flex flex-col border-t-[3px] p-4 transition-shadow hover:shadow-md"
      style={{ borderTopColor: `var(--g-${topic.genre.slug})` }}
    >
      <div className="mb-2 flex items-center gap-2">
        <GenreBadge genre={topic.genre} />
        <CoverageBadge count={topic.publisherCount} />
      </div>
      <TopicLink topic={topic} leadId={lead.id} className="headline">
        <h3 className="leading-snug font-bold group-hover:text-accent">{topic.title}</h3>
      </TopicLink>
      {summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-fg-muted">{summary}</p>}
      <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-fg-subtle">
        <PublisherAvatars names={publishers} max={4} />
        <PublisherLine publishers={publishers} max={2} />
        <time dateTime={topic.lastSeenAt.toISOString()} className="ml-auto shrink-0">{relativeTime(topic.lastSeenAt)}</time>
      </div>
    </article>
  );
}

type CardProps = { topic: TopicCardData; variant?: Variant; showGenre?: boolean; rank?: number };

/** 一覧の1行 */
export function TopicCard({ topic, variant = "standard", showGenre = true, rank }: CardProps) {
  const { lead, summary, publishers } = describe(topic);
  if (!lead) return null;
  const compact = variant === "compact";
  return (
    <article className={`group flex gap-3 ${compact ? "py-2.5" : "py-3.5"}`}>
      {rank !== undefined && (
        <span
          className={`w-7 shrink-0 text-center text-xl leading-tight font-black tabular-nums ${rank <= 3 ? "text-accent" : "text-fg-subtle"}`}
        >
          {rank}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <span className={`${compact ? "text-sm font-medium" : "text-[15px] font-bold"} leading-snug group-hover:text-accent`}>
            {topic.title}
          </span>
        </TopicLink>
        {!compact && summary && <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{summary}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          {showGenre && <GenreBadge genre={topic.genre} />}
          <CoverageBadge count={topic.publisherCount} />
          {topic.publisherCount > 1 && !compact && <PublisherAvatars names={publishers} max={4} />}
          <PublisherLine publishers={publishers} max={compact ? 2 : 3} />
          <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
        </div>
      </div>
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
