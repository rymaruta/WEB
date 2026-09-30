"use client";

import { useEffect, useRef, useState } from "react";
import { GenreIcon } from "./genre-icon";

type Props = {
  src: string | null;
  genreSlug: string;
  className?: string;
  /** 代替表示のアイコンの大きさ */
  iconClassName?: string;
  /** 画面の最初に見える画像は遅延読み込みしない */
  priority?: boolean;
};

/**
 * 記事のサムネイル。画像は各媒体のサーバーから直接表示し（当サイトには保存しない）、
 * 画像がない・読み込めない場合はジャンル色とアイコンの代替表示にする。
 */
export function Thumbnail({ src, genreSlug, className = "", iconClassName = "h-8 w-8", priority = false }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // サーバー描画された画像が、React の準備前に読み込みに失敗していた場合も代替表示にする
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  const color = `var(--g-${genreSlug})`;
  if (!src || failed) {
    return (
      <div
        aria-hidden
        className={`flex items-center justify-center text-white/85 ${className}`}
        style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 45%, #000))` }}
      >
        <GenreIcon slug={genreSlug} className={iconClassName} />
      </div>
    );
  }
  return (
    // 外部媒体の画像を複製・最適化せずにそのまま表示するため next/image は使わない
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`bg-surface-muted object-cover ${className}`}
    />
  );
}
