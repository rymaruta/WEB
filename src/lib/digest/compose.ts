import { CATEGORY_LABELS, LIMITS, type Category, type Sourced } from "@/lib/stories/schema";
import { textWidth } from "@/lib/stories/text";
import { jstDate, jstFullDateLabel, jstPostDate, jstShortDate, jstTime, SLOTS, type Slot } from "./slots";

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

const isAlnum = (ch: string | undefined) => !!ch && /[A-Za-z0-9]/.test(ch);

/** 2行の見出しを1文にする（英数字どうしの境目だけ空白を入れる） */
export function joinHeadline(lines: string[]): string {
  return lines.reduce((acc, l) => (acc && isAlnum(acc.at(-1)) && isAlnum(l[0]) ? `${acc} ${l}` : acc + l), "");
}

/** 投稿文の最後に添える、画像を開いてもらうための一言 */
export const POST_CTA = "画像をスワイプで詳しく👉";

/**
 * 本投稿の本文。回の印と日付・回の名前、空行、「・」付きで1本1行の見出し、空行、画像への案内。
 * 字下げはしない（X の狭い表示幅で長い見出しが折り返さないように）。
 * 例:
 *   🌙 10/1(木) 夜のニュース
 *
 *   ・米Micronが過去最高の決算
 *   ・MI5が中国機関と関係断つよう警告
 *
 *   画像をスワイプで詳しく👉
 * X の文字数上限を超える場合は、後ろの見出しから削る。
 */
export function composePostText(slot: Slot, date: string, entries: EditionEntry[]): string[] {
  const cfg = SLOTS[slot];
  const head = [`${cfg.emoji} ${jstPostDate(date)} ${cfg.title}`, ""];
  const tail = ["", POST_CTA];
  const items: string[] = [];
  for (const e of entries) {
    const line = `・${e.role === "FOLLOWUP" ? "続報：" : ""}${joinHeadline(e.headline)}`;
    if (textWidth(line) > LIMITS.postWidth) continue;
    if (textWidth([...head, ...items, line, ...tail].join("\n")) > LIMITS.postTotalWidth) break;
    items.push(line);
  }
  return items.length ? [...head, ...items, ...tail] : [head[0]];
}

// ---------------------------------------------------------------------------
// 投稿の分け方
// ---------------------------------------------------------------------------

/**
 * 投稿に添えるカードの番号（0 = INDEX、1 以降 = 掲載順）。1回の配信は1投稿で完結させ、リプライは使わない。
 * INDEX で全体を見せ、上位3本だけ詳しいカードを添える（X の1投稿は画像4枚まで）。
 */
export function splitParts(entryCount: number): number[][] {
  if (!entryCount) return [];
  const n = Math.min(entryCount, IMAGES_PER_POST - 1);
  return [[0, ...Array.from({ length: n }, (_, i) => i + 1)]];
}

/** リプライの本文（例: 「4・5本目」「4本目と続報」「続報」） */
export function replyText(entries: EditionEntry[], cards: number[]): string {
  const items = cards.map((n) => entries[n - 1]).filter(Boolean);
  const mainNos = items.filter((e) => e.role === "MAIN").map((e) => e.position);
  const hasFollowup = items.some((e) => e.role === "FOLLOWUP");
  const nos = mainNos.length ? `${mainNos.join("・")}本目` : "";
  const lines = [nos && hasFollowup ? `${nos}と続報` : nos || "続報"];
  // 本投稿と同じく、1本1行の見出しを続ける
  for (const e of items) {
    const line = `${e.role === "FOLLOWUP" ? "続報：" : ""}${joinHeadline(e.headline)}`;
    if (textWidth(line) > LIMITS.postWidth) continue;
    if (textWidth([...lines, line].join("\n")) > LIMITS.postTotalWidth) break;
    lines.push(line);
  }
  return lines.join("\n");
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
  /** detail は見出しの下に添える一番の要点（続報は「現在」） */
  entries: { label: string; color: string; text: string; detail: string; time: string; role: "MAIN" | "FOLLOWUP" }[];
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
    dateLabel: jstFullDateLabel(view.date),
    time,
    mainCount: main.length,
    timed: view.slot === "LUNCH",
    entries: view.entries.map((e) => ({
      label: e.role === "FOLLOWUP" ? "続報" : label(e),
      color: e.role === "FOLLOWUP" ? FOLLOWUP_COLOR : color(e),
      text: e.shortTitle,
      detail: (e.role === "FOLLOWUP" ? e.delta?.now.text : e.points[0]?.text) ?? "",
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
        ...card.entries.map((e, i) => `${card.timed ? e.time : i + 1}. ${e.label ? `［${e.label}］` : ""}${e.text}${e.detail ? `（${e.detail}）` : ""}`),
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
