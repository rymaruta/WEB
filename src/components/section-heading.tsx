import Link from "next/link";
import { GenreIcon } from "./genre-icon";

type Props = {
  title: string;
  href?: string;
  moreLabel?: string;
  /** 指定するとジャンルの色とアイコンで見出しを飾る */
  genreSlug?: string;
  as?: "h1" | "h2";
  note?: string;
};

export function SectionHeading({ title, href, moreLabel = "もっと見る", genreSlug, as: Tag = "h2", note }: Props) {
  const color = genreSlug ? `var(--g-${genreSlug})` : "var(--accent)";
  return (
    <div className="mb-2 flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2.5">
        {genreSlug ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: color }}
          >
            <GenreIcon slug={genreSlug} className="h-[18px] w-[18px]" />
          </span>
        ) : (
          <span aria-hidden className="h-5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        )}
        <div className="min-w-0">
          <Tag className="text-base leading-tight font-black sm:text-lg">{title}</Tag>
          {note && <p className="truncate text-[11px] text-fg-subtle">{note}</p>}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
        >
          {moreLabel}
        </Link>
      )}
    </div>
  );
}
