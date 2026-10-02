import { z } from "zod";

/** ゲームの話題から読み取る情報（ゲームタブの発売スケジュール・新着ゲームに使う） */

export const GAME_PLATFORMS = ["Switch 2", "Switch", "PS5", "PS4", "Xbox", "PC", "スマホ"] as const;
export const GAME_KINDS = ["announce", "release_date", "release", "update", "sale", "rumor", "other"] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export const GameSchema = z.object({
  title: z
    .string()
    .describe("ゲーム作品の正式なタイトル。資料に書かれている表記のまま（例: ポケモンレジェンズ Z-A、モンスターハンターワイルズ）。ゲーム機・技術・サービス・会社の名前は作品ではないので入れない"),
  titleKey: z
    .string()
    .optional()
    .describe("同じ作品を見分けるための呼び名。日本語の通称をカタカナと数字で（例: ACE COMBAT 8 → エースコンバット8、Abyss Ring → アビスリング）。画面には出さない"),
  releaseDate: z
    .string()
    .nullable()
    .describe("発売日（予定を含む）。資料に日付まで書かれていれば YYYY-MM-DD、月までなら YYYY-MM、年だけなら YYYY。書かれていなければ null。推測しない。延期の報道なら新しい日付"),
  platforms: z.array(z.enum(GAME_PLATFORMS)).describe("資料に書かれている対応機種。Steam や Windows は PC、iOS や Android はスマホ"),
  kind: z
    .enum(GAME_KINDS)
    .describe("announce=新作の発表、release_date=発売日の決定・変更、release=発売された、update=アップデート・追加コンテンツ、sale=セール・無料配布、rumor=公式発表ではない噂・リーク・関係者情報（資料が「〜と報じられた」「リーク」「噂」など公式でないと示している場合）、other=それ以外"),
});
export type GameInfo = z.infer<typeof GameSchema>;

const fold = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/**
 * 資料と照らし合わせる。タイトルは資料にそのまま書かれているもの、発売日は資料にその月・日が書かれているものだけを残す。
 * タイトルが確かめられなければ情報全体を使わない（ゲームの話題ではないとして扱う）
 */
export function verifyGame(g: GameInfo | null | undefined, sourceText: string): GameInfo | null {
  if (!g || !g.title.trim()) return null;
  const corpus = fold(sourceText);
  const title = g.title.trim();
  if (!corpus.includes(fold(title))) return null;
  return { ...g, title, releaseDate: verifyDate(g.releaseDate, sourceText), platforms: [...new Set(g.platforms)] };
}

/** 発売日が資料に書かれているか（「11月20日」「11/20」「2026年11月」など）。書かれていなければ null */
export function verifyDate(date: string | null, sourceText: string): string | null {
  if (!date) return null;
  const text = sourceText.normalize("NFKC");
  if (/^\d{4}$/.test(date)) return text.includes(`${date}年`) ? date : null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(date);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  if (month < 1 || month > 12) return null;
  if (d) {
    const day = Number(d);
    if (day < 1 || day > 31) return null;
    const dayForms = [`${month}月${day}日`, `${month}/${day}`, `${y}/${mo}/${d}`, `${y}-${mo}-${d}`, `${y}.${month}.${day}`];
    return dayForms.some((f) => text.includes(f)) ? date : null;
  }
  const monthForms = [`${y}年${month}月`, `${month}月`];
  return monthForms.some((f) => text.includes(f)) ? date : null;
}

export const GAME_KIND_LABELS: Record<GameKind, string> = {
  announce: "新作発表",
  release_date: "発売日決定",
  release: "発売",
  update: "アップデート",
  sale: "セール・無料",
  rumor: "噂・リーク",
  other: "",
};

/** 発売日の表示（2026-11-20 → 11月20日、2026-11 → 2026年11月、2027 → 2027年） */
export function releaseLabel(date: string, thisYear: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!m) return `${y}年`;
  if (!d) return `${y}年${m}月`;
  return y === thisYear ? `${m}月${d}日` : `${y}年${m}月${d}日`;
}

/** 並べ替え用の値（日付が決まっていないものは、その月・年の最後に置く） */
export function releaseSortKey(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}-${m ?? "13"}-${d ?? "32"}`;
}
