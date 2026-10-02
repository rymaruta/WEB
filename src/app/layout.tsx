import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { BackToTop } from "@/components/scroll-helpers";
import { FONT_SIZE_SCRIPT } from "@/components/font-size-toggle";
import { ReadTracker } from "@/components/read-tracker";
import { PageviewBeacon } from "@/components/pageview-beacon";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name} | ${siteConfig.tagline}`, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  openGraph: { siteName: siteConfig.name, locale: "ja_JP", type: "website" },
  twitter: { card: "summary_large_image" },
  // Google の検索結果や「おすすめ（Discover）」で、大きい画像と長めの説明を表示してよいと伝える
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  alternates: { canonical: "/", types: { "application/rss+xml": [{ url: "/feed.xml", title: `${siteConfig.name}（まとめ記事）` }] } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1b19" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 保存された文字サイズを、描画の前に反映する */}
        <script dangerouslySetInnerHTML={{ __html: FONT_SIZE_SCRIPT }} />
        {/* Google AdSense。async なので本文の表示を待たせない */}
        {siteConfig.adsenseClient && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${siteConfig.adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
      {/* スマホでは画面下メニューの高さ分だけ下に余白を取る */}
      <body className="flex min-h-full flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-accent px-4 py-2 font-bold text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          本文へスキップ
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <SiteFooter />
        <BottomNav />
        <BackToTop />
        <PageviewBeacon />
        <ReadTracker />
      </body>
    </html>
  );
}
