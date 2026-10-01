import { relativeTime } from "@/lib/format";
import { publisherLabel } from "@/lib/publisher";
import { ArticleLink, type LinkableArticle } from "./article-link";

type Item = LinkableArticle & { id: number; title: string; publisher: string; publishedAt: Date };

/** ヘッダー下を流れる新着見出し。動きを減らす設定の利用者には静止表示にする */
export function NewsTicker({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  const row = (hidden: boolean) =>
    items.map((a) => (
      <li key={`${hidden ? "b" : "a"}-${a.id}`} className="flex shrink-0 items-center gap-2 pr-10" aria-hidden={hidden || undefined}>
        <span className="text-[11px] font-semibold text-accent tabular-nums">{relativeTime(a.publishedAt)}</span>
        <ArticleLink article={a} className="text-sm hover:underline" tabIndex={hidden ? -1 : undefined}>
          {a.title}
        </ArticleLink>
        <span className="text-[11px] text-fg-subtle">{publisherLabel(a.publisher)}</span>
      </li>
    ));
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4">
        <span className="flex shrink-0 items-center gap-1.5 py-2 text-xs font-extrabold text-accent">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          新着
        </span>
        <div className="ticker-mask min-w-0 flex-1 overflow-hidden">
          <ul className="ticker-track flex w-max py-2">
            {row(false)}
            {row(true)}
          </ul>
        </div>
      </div>
    </div>
  );
}
