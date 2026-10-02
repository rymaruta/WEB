"use client";

import { useEffect, useRef, useState } from "react";
import { imageVariants } from "@/lib/image-variants";
import { GenreIcon } from "./genre-icon";

type Props = {
  src: string | null;
  genreSlug: string;
  className?: string;
  /** 代替表示のアイコンの大きさ */
  iconClassName?: string;
  /** 画面の最初に見える画像は遅延読み込みしない */
  priority?: boolean;
  /** 表示される幅。媒体が大きさ違いの画像を用意しているときに、どれを読み込むかの目安 */
  sizes?: string;
  /** 画像の出典（媒体名）。マウスを重ねたときに表示する */
  credit?: string;
};

/**
 * 記事のサムネイル。媒体が RSS で配信する画像を、当サイトで保存・加工せず、そのまま媒体から表示する（出典を明記する）。
 * 画像がない・読み込めない場合はジャンル色とアイコンの代替表示にする。
 */
export function Thumbnail({ src, genreSlug, className = "", iconClassName = "h-8 w-8", priority = false, credit, sizes = "(max-width: 640px) 100vw, 360px" }: Props) {
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
      // 媒体が大きさ違いの画像を用意していれば、表示の大きさに合ったものを選ぶ（数 MB の画像を小さな枠に読み込まない）
      {...(() => {
        const v = imageVariants(src);
        return v ? { src: v[0].url, srcSet: v.map((x) => `${x.url} ${x.width}w`).join(", "), sizes } : { src };
      })()}
      alt=""
      title={credit ? `画像：${credit}` : undefined}
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`bg-surface-muted object-cover ${className}`}
    />
  );
}
