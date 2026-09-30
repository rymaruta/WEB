import Link from "next/link";
import { relativeTime } from "@/lib/format";
import type { TopicCardData } from "@/lib/queries";
import { GenreBadge } from "./genre-badge";
import { OutboundLink } from "./outbound-link";

type Props = {
  topic: TopicCardData;
  variant?: "feature" | "standard" | "compact";
  showGenre?: boolean;
  rank?: number;
};

function uniquePublishers(topic: TopicCardData) {
  return [...new Set(topic.articles.map((a) => a.publisher))];
}

export function TopicCard({ topic, variant = "standard", showGenre = true, rank }: Props) {
  const primary = topic.articles.filter((a) => a.source.kind !== "SOCIAL");
  const lead = primary[0] ?? topic.articles[0];
  if (!lead) return null;
  const summary = (primary.find((a) => a.summary) ?? topic.articles.find((a) => a.summary))?.summary;
  const publishers = uniquePublishers(topic);
  const multi = topic.articleCount > 1;

  const titleClass =
    variant === "feature"
      ? "text-lg font-bold leading-snug sm:text-xl"
      : variant === "standard"
        ? "text-[15px] font-bold leading-snug"
        : "text-sm font-medium leading-snug";
  const title = (
    <span className={`headline ${titleClass} hover:text-accent hover:underline`}>{topic.title}</span>
  );

  return (
    <article className={`flex gap-3 ${variant === "compact" ? "py-2" : "py-3"}`}>
      {rank !== undefined && (
        <span
          className={`w-6 shrink-0 text-center text-lg font-extrabold tabular-nums ${rank <= 3 ? "text-accent" : "text-fg-subtle"}`}
        >
          {rank}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {multi ? (
          <Link href={`/topic/${topic.id}`} className="headline">
            {title}
          </Link>
        ) : (
          <OutboundLink articleId={lead.id} className="headline">
            {title}
          </OutboundLink>
        )}
        {variant !== "compact" && summary && (
          <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{summary}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          {showGenre && <GenreBadge genre={topic.genre} />}
          {topic.publisherCount > 1 && (
            <span className="rounded bg-accent-soft px-1.5 py-px font-semibold text-accent">
              {topic.publisherCount}媒体が報道
            </span>
          )}
          <span className="truncate">
            {publishers.slice(0, variant === "feature" ? 5 : 3).join("・")}
            {publishers.length > (variant === "feature" ? 5 : 3) && ` ほか${publishers.length - (variant === "feature" ? 5 : 3)}`}
          </span>
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
  variant?: Props["variant"];
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
