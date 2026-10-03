import Link from "next/link";

type Props = { genre: { slug: string; name: string }; link?: boolean };

export function GenreBadge({ genre, link = false }: Props) {
  const className =
    "inline-flex shrink-0 items-center rounded px-1.5 py-px text-[11px] font-semibold leading-5";
  // 文字が読める濃さにする（明るい表示は少し暗く・白い文字、暗い表示は少し明るく・黒い文字）
  const style = { backgroundColor: `color-mix(in oklab, var(--g-${genre.slug}, var(--fg-muted)) 80%, var(--badge-mix))`, color: "var(--badge-fg)" };
  return link ? (
    <Link href={`/genre/${genre.slug}`} className={className} style={style}>
      {genre.name}
    </Link>
  ) : (
    <span className={className} style={style}>
      {genre.name}
    </span>
  );
}
