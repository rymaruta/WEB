"use client";

import { getImageProps } from "next/image";
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
  /** 表示される幅（srcset からどの大きさを選ぶかの目安） */
  sizes?: string;
};

/**
 * 媒体の画像は数 MB のこともあるため、当サイトのサーバーで縮小・WebP 化してから配信する（next/image の最適化）。
 * 縮小版はサーバーと CDN に一時的に保存される。https 以外の画像は最適化できないため、そのまま表示する
 */
function imageProps(src: string, sizes: string, priority: boolean) {
  if (!src.startsWith("https://")) return { src };
  const { props } = getImageProps({ src, alt: "", width: 640, height: 360, sizes, quality: 60, priority });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}

/**
 * 記事のサムネイル。各媒体の画像を縮小して表示し、
 * 画像がない・読み込めない場合はジャンル色とアイコンの代替表示にする。
 */
export function Thumbnail({ src, genreSlug, className = "", iconClassName = "h-8 w-8", priority = false, sizes = "(max-width: 640px) 100vw, 360px" }: Props) {
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
    // onError で代替表示に切り替えるため、next/image の部品ではなく生成した属性を img に渡す
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      {...imageProps(src, sizes, priority)}
      alt=""
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`bg-surface-muted object-cover ${className}`}
    />
  );
}
