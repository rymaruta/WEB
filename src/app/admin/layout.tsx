import type { Metadata } from "next";

/** 管理画面をホーム画面に追加すると、管理画面が開く「ナビ管理」アプリになる（サイトのアイコンとは別） */
export const metadata: Metadata = {
  manifest: "/admin-manifest.webmanifest",
  appleWebApp: { capable: true, title: "ナビ管理" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
