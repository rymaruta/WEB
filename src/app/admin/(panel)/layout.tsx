import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/session";
import { logout } from "../actions";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: "管理画面", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <AdminNav />
        <form action={logout} className="shrink-0">
          <button type="submit" className="rounded px-1 py-2 text-xs whitespace-nowrap text-fg-muted hover:text-fg">
            ログアウト
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
