"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "配信", match: (p: string) => p === "/admin" || p.startsWith("/admin/editions") || p.startsWith("/admin/breaking") },
  { href: "/admin/analytics", label: "数字", match: (p: string) => p.startsWith("/admin/analytics") },
  { href: "/admin/tasks", label: "AIに頼む", match: (p: string) => p.startsWith("/admin/tasks") },
  { href: "/admin/logs", label: "記録", match: (p: string) => p.startsWith("/admin/logs") },
];

/** 管理画面のメニュー。開いている画面を塗りつぶして、いまどこにいるかを分かるようにする */
export function AdminNav() {
  const pathname = usePathname();
  return (
    // スマホでも1行に収め、収まらないときは横に動かせるようにする（文字が縦に折り返さないように）
    <nav className="scrollbar-none flex min-w-0 gap-1 overflow-x-auto" aria-label="管理メニュー">
      {NAV.map((n) => {
        const active = n.match(pathname);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-colors ${
              active ? "border-accent bg-accent text-accent-fg" : "border-border text-fg-muted hover:border-accent hover:text-accent"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
