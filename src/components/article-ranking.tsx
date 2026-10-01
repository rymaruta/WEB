import { relativeTime, formatNumber } from "@/lib/format";
import { cleanTitle } from "@/lib/feed/text";
import { publisherLabel } from "@/lib/publisher";
import { GenreBadge } from "./genre-badge";
import { ArticleLink, SummaryMark, type LinkableArticle } from "./article-link";
import { RankBadge } from "./rank-badge";

/** 閲覧回数がこれより少ないうちは回数を表示しない（少ない数字はかえって人気がないように見えるため） */
const MIN_CLICKS_SHOWN = 10;

type Item = LinkableArticle & {
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
          {ranked && <RankBadge rank={i + 1} />}
          <div className="min-w-0 flex-1">
            <ArticleLink article={a} className="headline text-sm leading-snug font-medium hover:text-accent hover:underline">
              {cleanTitle(a.title)}
            </ArticleLink>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
              <SummaryMark article={a} />
              {showGenre && <GenreBadge genre={a.genre} />}
              <span className="truncate">{publisherLabel(a.publisher)}</span>
              <time dateTime={a.publishedAt.toISOString()}>{relativeTime(a.publishedAt)}</time>
              {metric === "social" && <span className="font-semibold text-accent">{formatNumber(a.socialCount)} users</span>}
              {metric === "clicks" && a.clicks >= MIN_CLICKS_SHOWN && (
                <span className="font-semibold text-accent">{formatNumber(a.clicks)} 回</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
