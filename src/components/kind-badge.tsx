/**
 * 種類の印（値上げ・放送開始・発売など）。種類ごとに色を変えて、一目で見分けられるようにする。
 * 色は意味に合わせる（値上げ＝赤、値下げ＝青、開始＝緑、終了＝灰 など）。知らない種類は灰色
 */
const TONES = {
  red: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  orange: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  pink: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  gray: "border-border text-fg-muted",
} as const;

type Tone = keyof typeof TONES;

const TONE_OF: Record<string, Tone> = {
  // 暮らしの変更
  値上げ: "red",
  値下げ: "blue",
  "制度・法律": "violet",
  開始: "green",
  終了: "gray",
  // アニメ
  放送: "blue",
  配信: "green",
  劇場: "violet",
  // 新商品
  グルメ: "orange",
  スイーツ: "pink",
  ドリンク: "cyan",
  "家電・ガジェット": "blue",
  コスメ: "pink",
  ファッション: "amber",
  // 映画
  邦画: "orange",
  洋画: "blue",
  // 経済
  決算: "blue",
  業績予想: "violet",
  "M&A・提携": "orange",
  株主還元: "green",
  上場: "amber",
  // 障害・記事の種類
  復旧: "green",
  プレスリリース: "amber",
  // ゲーム
  新作発表: "violet",
  新作: "violet",
  発売日決定: "orange",
  発売: "green",
  アップデート: "blue",
  "セール・無料": "red",
  "噂・リーク": "gray",
};

/** 色を決めてある種類の名前か（ゲームの機種名のような、種類でない説明と見分ける） */
export function isKindLabel(label: string): boolean {
  return label in TONE_OF;
}

export function kindTone(label: string): string {
  return TONES[TONE_OF[label] ?? "gray"];
}

export function KindBadge({ label, className = "" }: { label: string; className?: string }) {
  return <span className={`shrink-0 rounded border px-1 text-[10px] leading-4 font-bold ${kindTone(label)} ${className}`}>{label}</span>;
}
