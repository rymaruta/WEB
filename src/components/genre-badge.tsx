import Link from "next/link";

type Props = { genre: { slug: string; name: string }; link?: boolean };

export function GenreBadge({ genre, link = false }: Props) {
  const className =
    "inline-flex shrink-0 items-center rounded px-1.5 py-px text-[11px] font-semibold leading-5 text-white";
  const style = { backgroundColor: `var(--g-${genre.slug}, var(--fg-muted))` };
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
