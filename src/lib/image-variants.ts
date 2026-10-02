/**
 * 媒体が用意している画像の大きさ違い（URL の中の幅を変えると、媒体自身が縮小した画像を返すもの）。
 * 当サイトで画像を加工・保存せず、媒体の画像のまま、表示の大きさに合ったものを選ぶために使う。DB に依存しない
 */
export type Variant = { url: string; width: number };

const WIDTHS = [480, 800] as const;

const RULES: { test: RegExp; make: (url: string, w: number) => string }[] = [
  // ITmedia の OGP 画像（…/ogp/…/2048 の末尾が幅）
  { test: /^https:\/\/www\.itmedia\.co\.jp\/.+\/ogp\/.+\/\d{3,4}$/, make: (u, w) => u.replace(/\/\d{3,4}$/, `/${w}`) },
  // 現代ビジネスなどの画像配信（…,w_1200,h_630）
  { test: /^https:\/\/cdn\.kds\.ltd\/.+w_\d+,h_\d+/, make: (u, w) => u.replace(/w_\d+,h_\d+/, `w_${w},h_${Math.round(w * 0.525)}`) },
];

/** 大きさ違いの URL（小さい順）。対応していない媒体は null（元の画像をそのまま使う） */
export function imageVariants(url: string): Variant[] | null {
  const rule = RULES.find((r) => r.test.test(url));
  return rule ? WIDTHS.map((w) => ({ url: rule.make(url, w), width: w })) : null;
}
