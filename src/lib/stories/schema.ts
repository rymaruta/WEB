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
  /** INDEX に載せる1行の見出し */
  shortTitleWidth: 14,
  /** 投稿文に使うキーワード */
  keywordWidth: 8,
  /** なぜ重要か（カードでは2行まで） */
  whyWidth: 26,
  /** 続報の「朝の時点」「現在」 */
  deltaWidth: 24,
  /** 投稿文：1行目が見出し、2行目以降が1本1行 */
  postLines: 8,
  postWidth: 28,
  /** 投稿文全体（X の上限 280 は全角 2・半角 1 で数えるため、全角換算で 140） */
  postTotalWidth: 140,
} as const;

const sourced = (text: string) =>
  z.object({
    text: z.string().describe(text),
    sources: z.array(z.number().int()).describe("根拠になった資料番号（1始まり）をすべて"),
  });

export const StoryAnalysisSchema = z.object({
  sufficient: z.boolean().describe("資料だけで内容を確かめられ、同じ出来事についての資料なら true。足りない・ばらばらなら false"),
  category: z.enum(CATEGORIES),
  cardType: z
    .enum(["NORMAL", "BREAKING", "IMPORTANT"])
    .describe("BREAKING=今すぐ読んだ人の行動が変わる出来事（命・安全・移動・お金。大地震、津波警報、大規模な運転見合わせ・通信障害、市場が大きく動く公式発表など）。IMPORTANT=社会的な影響が大きい出来事。それ以外は NORMAL"),
  importance: z.enum(["low", "normal", "high"]),
  riskFlags: z.array(z.enum(RISK_FLAGS)).describe("当てはまる分野をすべて。なければ空配列"),
  headline: z
    .array(z.string())
    .describe("見出し。1〜2行（行ごとに配列の要素）。各行は全角12字以内（半角英数字は0.5字）。事実のみ、誇張なし"),
  summary: z.string().describe("ニュースの核心を1〜2文で"),
  shortTitle: z.string().describe("一覧（INDEX）に載せる1行の見出し。全角14字以内。事実のみ"),
  keyword: z.string().describe("投稿文に使う、出来事を表す短い語。全角8字以内（例: ホルムズ海峡、ニデック決算）"),
  points: z.array(sourced("要点。全角16字以内の1行。体言止め可")).describe("要点を2〜3個。見出しの繰り返しは避ける"),
  why: sourced("なぜ重要か・何が変わるか。全角26字以内")
    .nullable()
    .describe("資料に、重要性や影響を示す記述（数字・公式の説明・専門家の見方など）がある場合だけ書く。資料にない推測で書かない。なければ null"),
  assessment: z
    .object({
      impact: z.number().int().describe("影響の大きさ 0〜3。0=ごく一部、1=特定の業界・地域、2=国内の多くの人、3=国内外の非常に多くの人"),
      longevity: z.number().int().describe("1週間後も意味があるか 0〜3。制度・市場・国際情勢への波及が大きいほど高い"),
      publicInterest: z.number().int().describe("公共性 0〜3。生活・安全・お金・社会の仕組みに関わるほど高い"),
      actionable: z.boolean().describe("読んだ人が今日、行動を変える必要がある（移動・安全・手続き・お金）"),
      gossip: z.boolean().describe("私生活・恋愛・不祥事の噂など、公共性の低いゴシップ"),
      promotional: z.boolean().describe("新商品・キャンペーンなど、宣伝の性格が強い"),
    })
    .describe("選定に使う評価。資料から分かる範囲で、控えめに付ける"),
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
  confidence: z.number().describe("資料の一致度・具体性から見た確からしさ 0〜1"),
});

export type StoryAnalysis = z.infer<typeof StoryAnalysisSchema>;
export type Assessment = StoryAnalysis["assessment"];
export type Sourced = { text: string; sources: number[] };

/** 続報の差分。前回の配信の内容と、新しい資料を比べて作る */
export const FollowupAnalysisSchema = z.object({
  sufficient: z.boolean().describe("新しい資料が前回と同じ出来事についてのもので、内容を確かめられるなら true"),
  newFacts: z
    .array(sourced("前回の配信の後に分かった事実。全角24字以内"))
    .describe("前回の配信に含まれていない、新しい事実（決定・発表・数字の更新など）を0〜2個。言い換えや同じ事実の繰り返しは入れない。なければ空配列"),
  before: z.string().describe("前回の配信の時点で分かっていたこと。全角24字以内。前回の内容だけを使う"),
  now: sourced("現在の状況。全角24字以内。新しい資料だけを根拠にする"),
  shortTitle: z.string().describe("一覧（INDEX）に載せる1行の見出し。全角14字以内（例: ニデック 会見で説明）"),
  confidence: z.number().describe("新しい資料の一致度・具体性から見た確からしさ 0〜1"),
});

export type FollowupAnalysis = z.infer<typeof FollowupAnalysisSchema>;

/** 続報の解析に渡す、前回の配信の内容 */
export type PreviousCoverage = {
  keyword: string;
  headline: string[];
  summary: string;
  points: string[];
  publishedAt: Date;
};

/** AI に渡す資料 */
export type StoryMaterial = {
  position: number;
  publisher: string;
  publishedAt: Date;
  title: string;
  summary: string | null;
  isPrimary: boolean;
};
