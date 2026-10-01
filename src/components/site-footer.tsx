import Link from "next/link";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-bold text-fg">{siteConfig.name}</span>
          <span className="ml-2">見出しと要約は各媒体の配信情報に基づきます。記事の著作権は各媒体に帰属します。</span>
        </p>
        <nav className="flex gap-2">
          <Link href="/about" className="rounded px-2 py-2 hover:text-fg">運営方針・お問い合わせ</Link>
          <Link href="/sources" className="rounded px-2 py-2 hover:text-fg">掲載メディア</Link>
        </nav>
      </div>
    </footer>
  );
}
