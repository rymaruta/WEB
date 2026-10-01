import { z } from "zod";

/** ストーリー解析の出力形式・ラベル。DB や API に依存しない */

export const CATEGORIES = ["TECH", "POLITICS", "ECONOMY", "WORLD", "SOCIETY", "SCIENCE", "SPORTS", "ENTERTAINMENT", "LIFE"] as const;
export type Category = (typeof CATEGORIES)[number];

/** カードと投稿本文に出す短いカテゴリー名 */
export const CATEGORY_LABELS: Record<Category, string> = {
  TECH: "テック",
  POLITICS: "政治",
  ECONOMY: "経済",
  WORLD: "国際",
  SOCIETY: "社会",
  SCIENCE: "科学",
  SPORTS: "スポーツ",
  ENTERTAINMENT: "エンタメ",
  LIFE: "ライフ",
};

/** 慎重な扱いが必要な分野。1つでも当てはまれば人の確認（REVIEW_REQUIRED）に回す */
export const RISK_FLAGS = ["DISASTER", "CRIME", "ACCIDENT", "POLITICS", "ELECTION", "WAR", "MEDICAL", "DEATH", "MARKET"] as const;

export const RISK_LABELS: Record<(typeof RISK_FLAGS)[number], string> = {
  DISASTER: "災害",
  CRIME: "事件",
  ACCIDENT: "事故",
  POLITICS: "政治",
  ELECTION: "選挙",
  WAR: "戦争・紛争",
  MEDICAL: "医療",
  DEATH: "死亡",
  MARKET: "相場に影響し得る",
};

/** 文字数の上限（全角換算。半角は 0.5） */
export const LIMITS = {
  headlineLines: 2,
  headlineWidth: 12,
  pointsMin: 2,
  pointsMax: 3,
  pointWidth: 16,
  postLines: 2,
  postWidth: 20,
} as const;

export const StoryAnalysisSchema = z.object({
  sufficient: z.boolean().describe("資料だけで内容を確かめられ、同じ出来事についての資料なら true。足りない・ばらばらなら false"),
  category: z.enum(CATEGORIES),
  cardType: z
    .enum(["NORMAL", "BREAKING", "IMPORTANT"])
    .describe("BREAKING=発生直後で続報が見込まれる出来事。IMPORTANT=社会的な影響が大きい出来事。それ以外は NORMAL"),
  importance: z.enum(["low", "normal", "high"]),
  riskFlags: z.array(z.enum(RISK_FLAGS)).describe("当てはまる分野をすべて。なければ空配列"),
  headline: z
    .array(z.string())
    .describe("見出し。1〜2行（行ごとに配列の要素）。各行は全角12字以内（半角英数字は0.5字）。事実のみ、誇張なし"),
  summary: z.string().describe("ニュースの核心を1〜2文で"),
  points: z
    .array(
      z.object({
        text: z.string().describe("要点。全角16字以内の1行。体言止め可"),
        sources: z.array(z.number().int()).describe("根拠になった資料番号（1始まり）をすべて"),
      }),
    )
    .describe("要点を2〜3個。見出しの繰り返しは避ける"),
  entities: z
    .object({
      people: z.array(z.string()),
      orgs: z.array(z.string()),
      places: z.array(z.string()),
      eventType: z.string().describe("出来事の種類を短く（例: 製品発表、判決、緊急着陸）"),
      eventDate: z.string().describe("出来事の日付 YYYY-MM-DD。資料から確かめられなければ「不明」"),
    })
    .describe("同じ出来事かどうかの判定に使う。資料に出てくる表記のまま"),
  eventTime: z.string().describe("出来事の日時。資料にある表記のまま。確かめられなければ「不明」"),
  conflicts: z.array(z.object({ about: z.string(), detail: z.string() })).describe("媒体間で食い違う事実。なければ空配列"),
  postText: z
    .array(z.string())
    .describe("投稿本文。原則1行、最大2行。各行は全角20字以内（1行目の先頭に付く【カテゴリー】の分を含めて）。【カテゴリー】は書かない（システムが付ける）"),
  confidence: z.number().describe("資料の一致度・具体性から見た確からしさ 0〜1"),
});

export type StoryAnalysis = z.infer<typeof StoryAnalysisSchema>;

/** AI に渡す資料 */
export type StoryMaterial = {
  position: number;
  publisher: string;
  publishedAt: Date;
  title: string;
  summary: string | null;
  isPrimary: boolean;
};
