import Link from "next/link";

type Props = { title: string; href?: string; moreLabel?: string; accent?: string; as?: "h1" | "h2" };

export function SectionHeading({ title, href, moreLabel = "もっと見る", accent, as: Tag = "h2" }: Props) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b border-border pb-2">
      <Tag className="flex items-center gap-2 text-base font-bold sm:text-lg">
        <span aria-hidden className="h-4 w-1 rounded-full" style={{ backgroundColor: accent ?? "var(--accent)" }} />
        {title}
      </Tag>
      {href && (
        <Link href={href} className="shrink-0 text-xs text-fg-muted hover:text-accent">
          {moreLabel} →
        </Link>
      )}
    </div>
  );
}
