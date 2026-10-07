import { z } from "zod";

const PointsSchema = z.array(z.object({ text: z.string(), sources: z.array(z.number().int()) }));
const SourcesSchema = z.array(z.number().int());
const BackgroundSchema = z.array(z.object({ topicId: z.number().int(), text: z.string() }));
const HistorySchema = z.array(z.object({ at: z.string(), sources: z.number().int() }));

export type AiArticle = {
  title: string;
  lead: string;
  body: string[];
  points: { text: string; sources: number[] }[];
  /** なぜ重要か（照合を通ったもの）。ないときは null */
  why: { text: string; sources: number[] } | null;
  /** 各媒体の報じ方の違い（ないときは空配列） */
  angles: { text: string; sources: number[] }[];
  /** これまでの経緯（古い順。このサイトの過去のまとめ記事へつなぐ）。ないときは空配列 */
  background: { topicId: number; text: string }[];
  /** 取り上げた企業（企業ページへのリンクに使う） */
  companies: string[];
  /** 作成・更新の記録（古い順）。記録が始まる前の記事は空 */
  history: { at: Date; sources: number }[];
  /** 出典番号（1始まり）に対応する記事 ID */
  sourceIds: number[];
  model: string | null;
  generatedAt: Date;
};

type TopicAiFields = {
  aiTitle: string | null;
  aiLead: string | null;
  aiBody: string | null;
  aiPoints: unknown;
  aiWhy?: unknown;
  aiAngles?: unknown;
  aiBackground?: unknown;
  aiCompanies?: string[];
  aiHistory?: unknown;
  aiSources: unknown;
  aiModel: string | null;
  aiGeneratedAt: Date | null;
};

/**
 * 読者向けでない文（生成の過程についての文・編集側の感想）。例：「資料には飛行距離は書かれていない」「謹んでご冥福をお祈りします」。
 * 記事は資料（各社の見出しと要約）だけから作るため、資料に何が書かれていないかは読者に伝える事実ではない。
 * 生成時の照合（src/lib/ai/prompt.ts）で落とし、すでに保存された記事も表示のときに落とす
 */
export const META_SENTENCE = /資料(には|は|に|で|から|の中|によると)|(記載|言及|記述)(は|が)(ない|なかった|見当たらない)|書かれていない|ご冥福|お祈り(します|いたします|申し上げます)/;

/** 文に分けて、読者向けでない文を除く（句点で区切る。残らなければ空文字） */
export function stripMetaSentences(text: string): string {
  if (!META_SENTENCE.test(text)) return text;
  return (text.match(/[^。！？]+[。！？]?/g) ?? []).filter((s) => !META_SENTENCE.test(s)).join("").trim();
}

const cleanPoints = <T extends { text: string }>(items: T[]) => items.map((p) => ({ ...p, text: stripMetaSentences(p.text) })).filter((p) => p.text);

/**
 * 検索への登録の判定に使う、要点・報じ方の違い・経緯の数。表示（readAiArticle）と同じ検証・同じ読者向けでない文の除去をしてから数える
 * （保存された配列の長さで数えると、表示で落ちる項目まで数えて、サイトマップと話題ページの判定が食い違うため）
 */
export function aiIndexCounts(t: { aiPoints: unknown; aiAngles?: unknown; aiBackground?: unknown }): { points: number; angles: number; background: number } {
  return {
    points: cleanPoints(PointsSchema.safeParse(t.aiPoints).data ?? []).length,
    angles: cleanPoints((t.aiAngles == null ? null : PointsSchema.safeParse(t.aiAngles).data) ?? []).length,
    background: (BackgroundSchema.safeParse(t.aiBackground).data ?? []).length,
  };
}

/** トピックに保存されたまとめ記事を、表示用に検証して取り出す。未作成・不正な場合は null */
export function readAiArticle(t: TopicAiFields): AiArticle | null {
  if (!t.aiTitle || !t.aiGeneratedAt || !t.aiBody) return null;
  const points = PointsSchema.safeParse(t.aiPoints);
  const sources = SourcesSchema.safeParse(t.aiSources);
  if (!points.success || !sources.success) return null;
  return {
    title: t.aiTitle,
    lead: stripMetaSentences(t.aiLead ?? ""),
    body: t.aiBody.split(/\n{2,}/).map(stripMetaSentences).filter(Boolean),
    points: cleanPoints(points.data),
    why: (() => {
      const w = PointsSchema.element.safeParse(t.aiWhy).data ?? null;
      const text = w ? stripMetaSentences(w.text) : "";
      return w && text ? { ...w, text } : null;
    })(),
    companies: t.aiCompanies ?? [],
    background: BackgroundSchema.safeParse(t.aiBackground).data ?? [],
    history: (HistorySchema.safeParse(t.aiHistory).data ?? []).map((h) => ({ at: new Date(h.at), sources: h.sources })),
    angles: cleanPoints((t.aiAngles == null ? null : PointsSchema.safeParse(t.aiAngles).data) ?? []),
    sourceIds: sources.data,
    model: t.aiModel,
    generatedAt: t.aiGeneratedAt,
  };
}
