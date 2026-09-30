"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { genres: { slug: string; name: string }[] };

export function GenreNav({ genres }: Props) {
  const pathname = usePathname();
  const items = [{ href: "/", label: "トップ" }, ...genres.map((g) => ({ href: `/genre/${g.slug}`, label: g.name })), { href: "/ranking", label: "ランキング" }];
  return (
    <nav aria-label="ジャンル" className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
