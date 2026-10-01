"use client";

import { useState } from "react";

type Props = { title: string; url: string };

const button =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 text-xs font-bold text-fg transition-colors hover:bg-surface-muted";

/** トピックのシェアボタン（X・LINE・はてなブックマーク・リンクのコピー。スマホでは端末の共有メニューも） */
export function ShareButtons({ title, url }: Props) {
  const [copied, setCopied] = useState(false);

  const text = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);
  const links = [
    { label: "X でポスト", short: "X", href: `https://x.com/intent/post?text=${text}&url=${encodedUrl}` },
    { label: "LINE で送る", short: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}` },
    { label: "はてなブックマークに追加", short: "はてブ", href: `https://b.hatena.ne.jp/entry/panel/?url=${encodedUrl}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  /** スマホ向け: 端末の共有メニューを開く。使えない環境ではリンクをコピーする */
  async function nativeShare() {
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title, url });
    } catch {
      // 利用者が共有をキャンセルした場合など
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="このニュースをシェア">
      <span className="text-xs font-bold text-fg-subtle">シェア</span>
      <button type="button" onClick={nativeShare} className={`${button} sm:hidden`}>
        共有する
      </button>
      {links.map((l) => (
        <a key={l.short} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} className={button}>
          {l.short}
        </a>
      ))}
      <button type="button" onClick={copy} className={button} aria-live="polite">
        {copied ? "コピーしました" : "リンクをコピー"}
      </button>
    </div>
  );
}
