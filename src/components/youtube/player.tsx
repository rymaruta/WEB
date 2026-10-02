"use client";

import { useState } from "react";
import { Thumbnail } from "@/components/thumbnail";

/**
 * YouTube の動画の再生。最初はサムネイルだけを出し、押したときに公式の埋め込みプレーヤー（youtube-nocookie.com）を読み込む
 * （ページを開いただけでは YouTube の読み込みも Cookie も発生しない。表示も速い）
 */
export function YouTubePlayer({ videoId, title, thumbnail, isShort = false }: { videoId: string; title: string; thumbnail: string; isShort?: boolean }) {
  const [play, setPlay] = useState(false);
  const box = isShort ? "mx-auto aspect-[9/16] max-h-[80vh]" : "aspect-video w-full";
  if (play) {
    return (
      <iframe
        className={`${box} rounded-xl border-0 bg-black`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }
  return (
    <button type="button" onClick={() => setPlay(true)} className={`group relative block overflow-hidden rounded-xl bg-black ${box}`} aria-label={`「${title}」を再生する`}>
      <Thumbnail src={thumbnail} genreSlug="entertainment" className="h-full w-full opacity-90 group-hover:opacity-100" priority sizes="(max-width: 768px) 100vw, 768px" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-14 w-20 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg group-hover:bg-red-700">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
