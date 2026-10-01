"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon, type NavIconName } from "./nav-icons";

const ITEMS: { href: string; label: string; icon: NavIconName }[] = [
  { href: "/", label: "トップ", icon: "home" },
  { href: "/ranking", label: "ランキング", icon: "ranking" },
  { href: "/articles", label: "まとめ記事", icon: "articles" },
  { href: "/search", label: "検索", icon: "search" },
];

/** スマホ用の画面下メニュー。片手で主要なページへ移動できるようにする（sm 以上では表示しない） */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
                  active ? "font-bold text-accent" : "font-medium text-fg-muted"
                }`}
              >
                <NavIcon name={item.icon} className="h-6 w-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
