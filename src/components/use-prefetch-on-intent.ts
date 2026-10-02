"use client";

import { useRouter } from "next/navigation";

/**
 * 指が触れた・マウスが乗った時点でページを先読みする。
 * 常に並んでいるメニューを最初から全部先読みすると通信が増えるため、押しそうになったときだけ読み込む
 */
export function usePrefetchOnIntent() {
  const router = useRouter();
  return (href: string) => ({
    onPointerDown: () => router.prefetch(href),
    onMouseEnter: () => router.prefetch(href),
  });
}
