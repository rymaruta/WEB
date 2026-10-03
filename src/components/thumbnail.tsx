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
  /** 人物写真は顔が上寄りにあるため、上寄せで切り抜く */
  portrait?: boolean;
  /** 画像がないときに、代替表示に大きく出す語（話題の中心の人名・社名など） */
  label?: string;
  /** 語を置く位置（大きな枠は下に媒体数を重ねるため上に置く） */
  labelAt?: "center" | "top";
};

/**
 * 記事のサムネイル。媒体が RSS で配信する画像を、当サイトで保存・加工せず、そのまま媒体から表示する（出典を明記する）。
 * 画像がない・読み込めない場合はジャンル色とアイコンの代替表示にする。
 */
export function Thumbnail({ src, genreSlug, className = "", iconClassName = "h-8 w-8", priority = false, credit, portrait = false, label, labelAt = "center", sizes = "(max-width: 640px) 100vw, 360px" }: Props) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // サーバー描画された画像が、React の準備前に読み込みに失敗していた場合も代替表示にする
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  const color = `var(--g-${genreSlug})`;
  if (!src || failed) {
    // 写真がない話題の、当サイトが描くサムネイル（ジャンルの色・模様・話題の中心の語）。画像を読み込まないので表示は速い
    return (
      <div
        aria-hidden
        className={`@container relative flex overflow-hidden text-white ${label ? (labelAt === "top" ? "items-start" : "items-center") : "items-center justify-center"} ${className}`}
        style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, #000))` }}
      >
        {/* 細かい点の模様と、右上の大きな円（写真のない枠を平板に見せない） */}
        <span className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.16)_1.2px,transparent_1.3px)] [background-size:14px_14px]" />
        <span className="pointer-events-none absolute -top-[25cqw] -right-[12cqw] aspect-square w-[55cqw] rounded-full bg-white/10" />
        {label ? (
          <>
            <GenreIcon slug={genreSlug} className="pointer-events-none absolute right-[5cqw] bottom-[5cqw] h-[18cqw] w-[18cqw] opacity-25" />
            <span
              className={`relative line-clamp-2 max-w-[78%] px-[6cqw] text-[clamp(12px,10cqw,46px)] leading-[1.1] font-black tracking-tight break-all [text-shadow:0_2px_10px_rgba(0,0,0,0.25)] ${labelAt === "top" ? "pt-[14cqw] md:pt-[10cqw]" : ""}`}
            >
              {label}
            </span>
          </>
        ) : (
          <GenreIcon slug={genreSlug} className={`relative opacity-85 ${iconClassName}`} />
        )}
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
      className={`bg-surface-muted object-cover ${portrait ? "object-[50%_20%]" : ""} ${className}`}
    />
  );
}
