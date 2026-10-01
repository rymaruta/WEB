/** 定時配信の設定と、日本時間の扱い。DB や API に依存しない */

export type Slot = "MORNING" | "LUNCH" | "EVENING";

export type SlotConfig = {
  /** INDEX と投稿文の見出し */
  title: string;
  /** 投稿文の先頭に付ける記号 */
  emoji: string;
  /** 投稿する時刻（日本時間 HH:MM） */
  publishAt: string;
  /** 下書きを作る時刻（日本時間 HH:MM） */
  buildAt: string;
  /** 承認の締め切り（投稿の何分前か） */
  deadlineMinutes: number;
  /** 載せる本数（続報を除く）。続報が少ない回は、続報の空き分だけ増やせる上限も持つ */
  mainCount: number;
  mainMax: number;
  /** 続報（結局どうなった）の最大数 */
  followupMax: number;
  /** 候補にするストーリーの新しさ（時間） */
  windowHours: number;
  /** 政治・経済・国際のいずれかを1本以上入れる */
  requireHardNews: boolean;
  /** 今日の配信に既に載った出来事も候補にする（夜の「今日これだけ」は1日のまとめのため） */
  allowRepeatToday: boolean;
};

export const SLOTS: Record<Slot, SlotConfig> = {
  MORNING: {
    title: "朝のニュース",
    emoji: "☀️",
    publishAt: "07:00",
    buildAt: "06:10",
    deadlineMinutes: 5,
    mainCount: 3,
    mainMax: 3,
    followupMax: 0,
    windowHours: 14,
    requireHardNews: true,
    allowRepeatToday: false,
  },
  LUNCH: {
    title: "昼のニュース",
    emoji: "🕛",
    publishAt: "12:00",
    buildAt: "11:10",
    deadlineMinutes: 5,
    mainCount: 3,
    mainMax: 3,
    followupMax: 0,
    windowHours: 6,
    requireHardNews: false,
    allowRepeatToday: false,
  },
  EVENING: {
    title: "夜のニュース",
    emoji: "🌙",
    publishAt: "20:00",
    buildAt: "19:10",
    deadlineMinutes: 5,
    mainCount: 2,
    mainMax: 3,
    followupMax: 1,
    windowHours: 16,
    requireHardNews: true,
    allowRepeatToday: true,
  },
};

export const SLOT_ORDER: Slot[] = ["MORNING", "LUNCH", "EVENING"];

/** 1つの配信回に載せる本数の上限。X の1投稿は画像4枚まで（INDEX＋3本）で、1投稿で完結させる */
export const MAX_ITEMS = 3;

const JST_OFFSET_MS = 9 * 3_600_000;

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDate(at: Date): string {
  return new Date(at.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 日本時間の日付と時刻から、その瞬間を返す */
export function jstAt(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00+09:00`);
}

function weekday(date: string): string {
  const d = new Date(`${date}T12:00:00+09:00`);
  return "日月火水木金土"[new Date(d.getTime() + JST_OFFSET_MS).getUTCDay()];
}

/** 日本時間の「10月1日（木）」 */
export function jstDateLabel(date: string): string {
  const [, m, day] = date.split("-").map(Number);
  return `${m}月${day}日（${weekday(date)}）`;
}

/** カード用の「2026年10月1日（木）」（画像は保存・転載されるため年も入れる） */
export function jstFullDateLabel(date: string): string {
  return `${date.slice(0, 4)}年${jstDateLabel(date)}`;
}

/** 投稿文の「10/1(木)」 */
export function jstPostDate(date: string): string {
  const [, m, day] = date.split("-").map(Number);
  return `${m}/${day}(${weekday(date)})`;
}

/** 日本時間の「7:00」 */
export function jstTime(at: Date): string {
  const d = new Date(at.getTime() + JST_OFFSET_MS);
  return `${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** 日本時間の「10/1」 */
export function jstShortDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}`;
}

/** 配信回の一意の鍵 */
export function editionKey(date: string, slot: Slot | "BREAKING", storyId?: string): string {
  return slot === "BREAKING" ? `${date}:BREAKING:${storyId}` : `${date}:${slot}`;
}

/** 次にその時刻（日本時間 HH:MM）になるまでのミリ秒 */
export function msUntilJst(hhmm: string, now: Date): number {
  let target = jstAt(jstDate(now), hhmm);
  if (target.getTime() <= now.getTime()) target = new Date(target.getTime() + 24 * 3_600_000);
  return target.getTime() - now.getTime();
}

/**
 * おまかせ投稿（既定でオン）。下書きは自動の確認を通ったストーリーだけで作り、
 * 投稿の時刻までに人が承認しなくても、そのまま投稿する。DIGEST_AUTO_APPROVE=false で、人の承認が必要な運用に戻す
 */
export function autoApproveEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DIGEST_AUTO_APPROVE !== "false";
}
