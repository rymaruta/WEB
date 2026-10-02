"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { GenreIcon } from "./genre-icon";
import { usePrefetchOnIntent } from "./use-prefetch-on-intent";
import { NavIcon } from "./nav-icons";

type Props = { genres: { slug: string; name: string }[] };

export function GenreNav({ genres }: Props) {
  const pathname = usePathname();
  const intent = usePrefetchOnIntent();
  const navRef = useRef<HTMLElement>(null);
  // 開いているタブが見えるよう、タブの列を横に動かす（左右になぞって切り替えたときも、今どこかが分かるように）
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [pathname]);
  const items = [
    // いちばん大きな話題（まとめ記事つき）。一番先に置き、スマホでも出す
    { href: "/trending", label: "話題", slug: null, featured: true, desktopOnly: false, icon: "flame" as "company" | "video" | "flame" | null },
    // トップ・ランキング・まとめ記事は、スマホでは下のメニューにあるため PC でだけ出す
    { href: "/", label: "トップ", slug: null, featured: false, desktopOnly: true, icon: null },
    // ランキングはよく見られるため、トップの次に置いてアクセント色で目立たせる
    { href: "/ranking", label: "ランキング", slug: null, featured: true, desktopOnly: true, icon: null },
    { href: "/articles", label: "まとめ記事", slug: null, featured: false, desktopOnly: true, icon: null },
    ...genres.flatMap((g) => {
      const genre = { href: `/genre/${g.slug}`, label: g.name, slug: g.slug as string | null, featured: false, desktopOnly: false, icon: null as "company" | "video" | "flame" | null };
      // 企業別ニュースは、経済の隣に置く（気になる企業のニュースだけを追いたい人が多いため）
      if (g.slug === "business") return [genre, { href: "/company", label: "企業別", slug: null, featured: false, desktopOnly: false, icon: "company" as const }];
      // YouTube の新着動画は、エンタメの隣に置く
      if (g.slug === "entertainment") return [genre, { href: "/youtube", label: "YouTube", slug: null, featured: false, desktopOnly: false, icon: "video" as const }];
      return [genre];
    }),
  ];
  return (
    <nav ref={navRef} aria-label="ジャンル" className="scrollbar-none -mb-px flex gap-0.5 overflow-x-auto">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const color = item.slug ? `var(--g-${item.slug})` : "var(--accent)";
        return (
          <Link
            // ジャンルは画面に並ぶだけで全部を先読みすると、閲覧のたびにサーバーへ十数回の問い合わせが走るため、触れたときだけ読み込む
            prefetch={false}
            {...intent(item.href)}
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${item.desktopOnly ? "hidden sm:flex" : "flex"} shrink-0 items-center gap-1.5 border-b-[3px] px-2.5 py-2.5 text-sm whitespace-nowrap transition-colors ${
              active
                ? "font-bold text-fg"
                : item.featured
                  ? "border-transparent font-bold text-accent hover:text-fg"
                  : "border-transparent font-medium text-fg-muted hover:text-fg"
            }`}
            style={active ? { borderColor: color } : undefined}
          >
            {item.slug && <GenreIcon slug={item.slug} className="h-4 w-4" />}
            {item.featured && !item.icon && <NavIcon name="ranking" className="h-4 w-4" />}
            {item.icon && <NavIcon name={item.icon} className="h-4 w-4" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
