import { relativeTime, formatNumber } from "@/lib/format";
import { GenreBadge } from "./genre-badge";
import { OutboundLink } from "./outbound-link";

type Item = {
  id: number;
  title: string;
  publisher: string;
  publishedAt: Date;
  socialCount: number;
  clicks: number;
  genre: { slug: string; name: string };
};

type Props = { items: Item[]; metric?: "social" | "clicks" | "none"; showGenre?: boolean; emptyText?: string };

export function ArticleRanking({ items, metric = "none", showGenre = false, emptyText = "まだデータがありません。" }: Props) {
  if (items.length === 0) return <p className="py-4 text-sm text-fg-subtle">{emptyText}</p>;
  const ranked = metric !== "none";
  return (
    <ol className="divide-y divide-border">
      {items.map((a, i) => (
        <li key={a.id} className="flex gap-3 py-2.5">
          {ranked && (
            <span className={`w-5 shrink-0 text-center font-extrabold tabular-nums ${i < 3 ? "text-accent" : "text-fg-subtle"}`}>
              {i + 1}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <OutboundLink articleId={a.id} className="headline text-sm leading-snug font-medium hover:text-accent hover:underline">
              {a.title}
            </OutboundLink>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
              {showGenre && <GenreBadge genre={a.genre} />}
              <span className="truncate">{a.publisher}</span>
              <time dateTime={a.publishedAt.toISOString()}>{relativeTime(a.publishedAt)}</time>
              {metric === "social" && <span className="font-semibold text-accent">{formatNumber(a.socialCount)} users</span>}
              {metric === "clicks" && <span className="font-semibold text-accent">{formatNumber(a.clicks)} 回</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
