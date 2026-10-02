import Link from "next/link";
import { siteConfig } from "@/config/site";

/** フッターのリンク。種類の違うページを1列に混ぜず、見出しを付けて分ける */
const GROUPS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "特集・データ",
    links: [
      { href: "/feature", label: "特集" },
      { href: "/calendar", label: "ぜんぶカレンダー" },
      { href: "/weekly", label: "今週の10大ニュース" },
      { href: "/daily", label: "日付別ニュース" },
      { href: "/archive", label: "月間まとめ" },
      { href: "/prices", label: "値上げ・値下げデータベース" },
      { href: "/compare", label: "報道くらべ" },
      { href: "/company", label: "企業別ニュース" },
      { href: "/youtube", label: "YouTube 新着動画" },
    ],
  },
  {
    title: "便利な機能",
    links: [
      { href: "/following", label: "フォロー中" },
      { href: "/saved", label: "あとで読む" },
      { href: "/digest", label: "配信アーカイブ" },
    ],
  },
  {
    title: "このサイトについて",
    links: [
      { href: "/about", label: "運営方針・お問い合わせ" },
      { href: "/sources", label: "掲載メディア" },
      { href: "/privacy", label: "プライバシーポリシー" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 text-sm text-fg-muted">
        <nav aria-label="サイト内のページ" className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <h2 className="mb-1 text-xs font-bold text-fg">{g.title}</h2>
              <ul>
                {g.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} className="inline-block py-1.5 hover:text-fg">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="inline-block py-1.5 hover:text-fg">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p>
          <span className="font-bold text-fg">{siteConfig.name}</span>
          <span className="ml-2">見出しと要約は各媒体の配信情報に基づきます。記事の著作権は各媒体に帰属します。</span>
        </p>
      </div>
    </footer>
  );
}
