"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "配信", match: (p: string) => p === "/admin" || p.startsWith("/admin/editions") },
  { href: "/admin/analytics", label: "数字", match: (p: string) => p.startsWith("/admin/analytics") },
  { href: "/admin/logs", label: "記録", match: (p: string) => p.startsWith("/admin/logs") },
];

/** 管理画面のメニュー。開いている画面を塗りつぶして、いまどこにいるかを分かるようにする */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1" aria-label="管理メニュー">
      {NAV.map((n) => {
        const active = n.match(pathname);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
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
