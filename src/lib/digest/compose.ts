import { CATEGORY_LABELS, LIMITS, type Category, type Sourced } from "@/lib/stories/schema";
import { textWidth } from "@/lib/stories/text";
import { jstDate, jstDateLabel, jstShortDate, jstTime, SLOTS, type Slot } from "./slots";

/**
 * 配信回の中身（投稿文・投稿の分け方・カード・代替テキスト）を組み立てる。DB に依存しない。
 */

/** カテゴリーの色（サイトのジャンル色にそろえる） */
export const CATEGORY_COLORS: Record<Category, string> = {
  POLITICS: "#2563eb",
  ECONOMY: "#047857",
  WORLD: "#0e7490",
  SOCIETY: "#475569",
  TECH: "#7c3aed",
  SCIENCE: "#4f46e5",
  SPORTS: "#ea580c",
  ENTERTAINMENT: "#db2777",
  LIFE: "#0d9488",
};
export const FOLLOWUP_COLOR = "#2b3f8f";
export const BREAKING_COLOR = "#d4590b";
export const INK = "#16181d";

/** 1投稿の画像の上限（X の仕様） */
export const IMAGES_PER_POST = 4;

/** 配信回に載せる1本（Story に人の編集 override を反映したもの） */
export type EditionEntry = {
  position: number;
  role: "MAIN" | "FOLLOWUP";
  category: Category | null;
  headline: string[];
  shortTitle: string;
  keyword: string;
  points: Sourced[];
  why: Sourced | null;
  /** 続報の差分。previousAt は前回の配信の時刻 */
  delta: { before: string; now: Sourced; previousAt: Date | null } | null;
  /** 出典の媒体名（資料番号の順） */
  publishers: string[];
  /** 出来事が最初に報じられた時刻（昼の INDEX に出す） */
  firstSeenAt: Date;
};

export type EditionView = {
  slot: Slot;
  date: string;
  scheduledAt: Date;
  entries: EditionEntry[];
};

// ---------------------------------------------------------------------------
// 投稿文
// ---------------------------------------------------------------------------

const fitsLine = (s: string) => textWidth(s) <= LIMITS.postWidth;

/** 2行目に入れるキーワードの並び。上限に収まるまで減らす */
function keywordsLine(keywords: string[], suffix: string): string | null {
  const ks = keywords.filter(Boolean);
  for (let n = Math.min(2, ks.length); n >= 1; n--) {
    const line = `${ks.slice(0, n).join("・")}${suffix}`;
    if (fitsLine(line)) return line;
  }
  return null;
}

/**
 * 本投稿の本文。1行目は回の名前と本数、2行目は今回の中身（上位2本のキーワード）。
 * 例: 「☀️ 朝これだけ（5本）」「ホルムズ海峡・ニデック決算ほか」
 */
export function composePostText(slot: Slot, entries: EditionEntry[]): string[] {
  const cfg = SLOTS[slot];
  const main = entries.filter((e) => e.role === "MAIN");
  const follow = entries.filter((e) => e.role === "FOLLOWUP");
  const count = follow.length ? `${main.length}本＋続報${follow.length}` : `${main.length}本`;
  const first = `${cfg.emoji} ${cfg.title}（${count}）`;
  const second = follow.length
    ? keywordsLine(
        follow.map((e) => e.keyword),
        "のその後も",
      )
    : keywordsLine(
        main.map((e) => e.keyword),
        main.length > 2 ? "ほか" : "",
      );
  return second ? [first, second] : [first];
}

// ---------------------------------------------------------------------------
// 投稿の分け方（本投稿＋自分へのリプライ）
// ---------------------------------------------------------------------------

/** カードの番号（0 = INDEX、1 以降 = 掲載順）を、1投稿4枚ずつに分ける */
export function splitParts(entryCount: number): number[][] {
  const cards = Array.from({ length: entryCount + 1 }, (_, i) => i);
  const parts: number[][] = [];
  for (let i = 0; i < cards.length; i += IMAGES_PER_POST) parts.push(cards.slice(i, i + IMAGES_PER_POST));
  return parts;
}

/** リプライの本文（例: 「4・5本目」「4本目と続報」「続報」） */
export function replyText(entries: EditionEntry[], cards: number[]): string {
  const items = cards.map((n) => entries[n - 1]).filter(Boolean);
  const mainNos = items.filter((e) => e.role === "MAIN").map((e) => e.position);
  const hasFollowup = items.some((e) => e.role === "FOLLOWUP");
  const nos = mainNos.length ? `${mainNos.join("・")}本目` : "";
  if (nos && hasFollowup) return `${nos}と続報`;
  return nos || "続報";
}

// ---------------------------------------------------------------------------
// カード
// ---------------------------------------------------------------------------

export type IndexCard = {
  type: "INDEX";
  slot: Slot;
  title: string;
  emoji: string;
  dateLabel: string;
  time: string;
  mainCount: number;
  /** 昼は番号の代わりに時刻を出す */
  timed: boolean;
  entries: { label: string; color: string; text: string; time: string; role: "MAIN" | "FOLLOWUP" }[];
};

export type NewsCard = {
  type: "NEWS";
  color: string;
  label: string;
  slotTitle: string;
  counter: string;
  headline: string[];
  points: string[];
  why: string | null;
  sources: string;
  stamp: string;
};

export type FollowupCard = {
  type: "FOLLOWUP";
  slotTitle: string;
  counter: string;
  headline: string[];
  /** 「朝の時点」「昨夜の時点」など */
  beforeLabel: string;
  before: string;
  now: string;
  sources: string;
  stamp: string;
};

export type BreakingCard = {
  type: "BREAKING";
  /** 「10:42 時点」 */
  asOf: string;
  headline: string[];
  points: string[];
  /** まだ分かっていないこと（人が書く。なければ出さない） */
  unknown: string | null;
  sources: string;
  stamp: string;
};

export type Card = IndexCard | NewsCard | FollowupCard | BreakingCard;

/** ドメイン名で記録された媒体（ソーシャル経由の記事）を、読者に分かる名前にする */
const PUBLISHER_NAMES: Record<string, string> = {
  "yomiuri.co.jp": "読売新聞",
  "asahi.com": "朝日新聞",
  "mainichi.jp": "毎日新聞",
  "nikkei.com": "日本経済新聞",
  "sankei.com": "産経新聞",
  "tokyo-np.co.jp": "東京新聞",
  "jiji.com": "時事通信",
  "kyodonews.jp": "共同通信",
  "nhk.or.jp": "NHK",
  "news.yahoo.co.jp": "Yahoo!ニュース",
  "cnn.co.jp": "CNN",
  "bbc.com": "BBC",
  "reuters.com": "ロイター",
  "bloomberg.co.jp": "ブルームバーグ",
  "tv-asahi.co.jp": "テレビ朝日",
  "fnn.jp": "FNN",
  "news.tbs.co.jp": "TBS",
  "news.ntv.co.jp": "日本テレビ",
};

export function publisherLabel(publisher: string): string {
  const host = publisher.toLowerCase().replace(/^www\./, "");
  return PUBLISHER_NAMES[host] ?? publisher;
}

/** 出典の表記。媒体名を2つまで出し、残りは「ほかN」 */
export function sourcesLine(publishers: string[]): string {
  const unique = [...new Set(publishers.map(publisherLabel))];
  const shown = unique.slice(0, 2).join("・");
  const rest = unique.length - 2;
  return `出典：${shown}${rest > 0 ? ` ほか${rest}` : ""}`;
}

/** 前回の配信がいつだったかを、読者に分かる言葉にする */
export function beforeLabel(previousAt: Date | null, date: string): string {
  if (!previousAt) return "前回";
  const hour = Number(jstTime(previousAt).split(":")[0]);
  if (jstDate(previousAt) !== date) return hour >= 17 ? "昨夜の時点" : "前回";
  return hour < 11 ? "朝の時点" : hour < 17 ? "昼の時点" : "前回";
}

export function buildCards(view: EditionView): Card[] {
  const cfg = SLOTS[view.slot];
  const time = jstTime(view.scheduledAt);
  const stamp = `${jstShortDate(view.date)} ${time}`;
  const main = view.entries.filter((e) => e.role === "MAIN");
  const follow = view.entries.filter((e) => e.role === "FOLLOWUP");
  const color = (e: EditionEntry) => (e.category ? CATEGORY_COLORS[e.category] : INK);
  const label = (e: EditionEntry) => (e.category ? CATEGORY_LABELS[e.category] : "");

  const index: IndexCard = {
    type: "INDEX",
    slot: view.slot,
    title: cfg.title,
    emoji: cfg.emoji,
    dateLabel: jstDateLabel(view.date),
    time,
    mainCount: main.length,
    timed: view.slot === "LUNCH",
    entries: view.entries.map((e) => ({
      label: e.role === "FOLLOWUP" ? "続報" : label(e),
      color: e.role === "FOLLOWUP" ? FOLLOWUP_COLOR : color(e),
      text: e.shortTitle,
      time: jstTime(e.firstSeenAt),
      role: e.role,
    })),
  };

  const cards: Card[] = [index];
  for (const e of view.entries) {
    if (e.role === "FOLLOWUP" && e.delta) {
      cards.push({
        type: "FOLLOWUP",
        slotTitle: cfg.title,
        counter: `${follow.indexOf(e) + 1}/${follow.length}`,
        headline: e.headline,
        beforeLabel: beforeLabel(e.delta.previousAt, view.date),
        before: e.delta.before,
        now: e.delta.now.text,
        sources: sourcesLine(e.publishers),
        stamp,
      });
    } else {
      cards.push({
        type: "NEWS",
        color: color(e),
        label: label(e),
        slotTitle: cfg.title,
        counter: `${main.indexOf(e) + 1}/${main.length}`,
        headline: e.headline,
        // 「なぜ重要」がある場合、要点は2つまで（中央の帯に収めるため）
        points: e.points.slice(0, e.why ? 2 : 3).map((p) => p.text),
        why: e.why?.text ?? null,
        sources: sourcesLine(e.publishers),
        stamp,
      });
    }
  }
  return cards;
}

/** 速報のカード。時刻は「◯時◯分時点」と明記し、分かっていないことを分けて書く（仕様 15 章） */
export function buildBreakingCard(entry: EditionEntry, at: Date, unknown: string | null): BreakingCard {
  const time = jstTime(at);
  return {
    type: "BREAKING",
    asOf: `${time} 時点`,
    headline: entry.headline,
    points: entry.points.slice(0, unknown ? 2 : 3).map((p) => p.text),
    unknown,
    sources: sourcesLine(entry.publishers),
    stamp: `${jstShortDate(jstDate(at))} ${time}`,
  };
}

/** 代替テキストの上限（X の仕様は1000字） */
const ALT_MAX = 1000;

/** 画像の代替テキスト。読み上げで、カードの文字がそのまま聞けるようにする */
export function altText(card: Card): string {
  let text: string;
  switch (card.type) {
    case "INDEX":
      text = [
        `${card.title}（${card.dateLabel} ${card.time}）`,
        ...card.entries.map((e, i) => `${card.timed ? e.time : i + 1}. ${e.label ? `［${e.label}］` : ""}${e.text}`),
      ].join("\n");
      break;
    case "NEWS":
      text = [
        `${card.label ? `［${card.label}］` : ""}${card.headline.join(" ")}`,
        ...card.points.map((p) => `・${p}`),
        card.why ? `なぜ重要：${card.why}` : "",
        card.sources,
      ]
        .filter(Boolean)
        .join("\n");
      break;
    case "BREAKING":
      text = [`［速報 ${card.asOf}］${card.headline.join(" ")}`, ...card.points.map((p) => `・${p}`), card.unknown ? `まだ分かっていないこと：${card.unknown}` : "", card.sources]
        .filter(Boolean)
        .join("\n");
      break;
    case "FOLLOWUP":
      text = [`［続報］${card.headline.join(" ")}`, `${card.beforeLabel}：${card.before}`, `現在：${card.now}`, card.sources].join("\n");
      break;
  }
  return [...text].slice(0, ALT_MAX).join("");
}
