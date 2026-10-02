/** ぜんぶカレンダーの分野（画面からも使うので DB に依存しない） */

export const CALENDAR_CATEGORIES = ["changes", "game", "anime", "movie", "products"] as const;
export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export const CALENDAR_LABELS: Record<CalendarCategory, string> = {
  changes: "暮らしの変更",
  game: "ゲーム",
  anime: "アニメ",
  movie: "映画",
  products: "新商品",
};

/** 分野の色（ジャンルの色を使う） */
export const CALENDAR_COLORS: Record<CalendarCategory, string> = {
  changes: "var(--g-life)",
  game: "var(--g-game)",
  anime: "var(--g-anime)",
  movie: "var(--g-entertainment)",
  products: "var(--g-products)",
};

export type CalendarItem = {
  /** YYYY-MM-DD */
  date: string;
  category: CalendarCategory;
  title: string;
  /** 補足（機種・放送局・会社・値上げなど） */
  note: string | null;
  /** サイト内のページ（話題）か、外部のページ（公式ストア） */
  href: string | null;
  external: boolean;
};

/** 予定ごとに決まる ID（同じ予定にはいつも同じ値。選んだ予定だけをカレンダーに追加するときの目印にも使う） */
export function eventId(it: Pick<CalendarItem, "category" | "date" | "title">): string {
  let h = 5381;
  for (const ch of `${it.category}|${it.date}|${it.title}`) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return `${it.category}-${it.date}-${h.toString(36)}`;
}

export const isCalendarCategory = (c: string): c is CalendarCategory => (CALENDAR_CATEGORIES as readonly string[]).includes(c);

