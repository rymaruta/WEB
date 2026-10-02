"use client";

import { useEffect } from "react";
import { reloadOnce } from "@/lib/client/reload-once";

/**
 * サイト全体の枠（ヘッダーなど）で起きたエラー。英語の標準画面の代わりに日本語で案内する。
 * サイトの更新直後に起きやすいため、まず一度だけ自動で読み直す
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reloadOnce();
  }, [error]);
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f5f2", color: "#1b1b19" }}>
        <main style={{ maxWidth: 480, margin: "15vh auto", padding: 24, textAlign: "center" }}>
          <p style={{ fontWeight: 800, color: "#d84a2b" }}>ぜんぶナビ</p>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>ページを表示できませんでした</h1>
          <p style={{ fontSize: 14, color: "#5d5b57" }}>サイトの更新直後などに起きることがあります。再読み込みすると表示されます。</p>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ background: "#d84a2b", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14 }}
            >
              再読み込み
            </button>
            {/* 全体の枠が壊れているときは、ページの移動も通常の読み込みで行う */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ border: "1px solid #ccc", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 14, color: "inherit", textDecoration: "none" }}>
              トップへ
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
