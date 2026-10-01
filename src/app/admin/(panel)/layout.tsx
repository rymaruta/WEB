import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/session";
import { logout } from "../actions";

export const metadata: Metadata = { title: "管理画面", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "配信" },
  { href: "/admin/logs", label: "記録" },
];

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <nav className="flex gap-1" aria-label="管理メニュー">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full border border-border px-4 py-2 text-sm font-bold hover:border-accent hover:text-accent">
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={logout}>
          <button type="submit" className="rounded px-2 py-2 text-sm text-fg-muted hover:text-fg">
            ログアウト
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
