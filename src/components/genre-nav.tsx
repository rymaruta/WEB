"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GenreIcon } from "./genre-icon";

type Props = { genres: { slug: string; name: string }[] };

export function GenreNav({ genres }: Props) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "トップ", slug: null },
    { href: "/articles", label: "まとめ記事", slug: null },
    ...genres.map((g) => ({ href: `/genre/${g.slug}`, label: g.name, slug: g.slug })),
    { href: "/ranking", label: "ランキング", slug: null },
  ];
  return (
    <nav aria-label="ジャンル" className="scrollbar-none -mb-px flex gap-0.5 overflow-x-auto">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const color = item.slug ? `var(--g-${item.slug})` : "var(--accent)";
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-[3px] px-2.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
              active ? "font-bold text-fg" : "border-transparent font-medium text-fg-muted hover:text-fg"
            }`}
            style={active ? { borderColor: color } : undefined}
          >
            {item.slug && <GenreIcon slug={item.slug} className="h-4 w-4" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
