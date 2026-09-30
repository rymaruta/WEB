import { z } from "zod";

const PointsSchema = z.array(z.object({ text: z.string(), sources: z.array(z.number().int()) }));
const SourcesSchema = z.array(z.number().int());

export type AiArticle = {
  title: string;
  lead: string;
  body: string[];
  points: { text: string; sources: number[] }[];
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
  aiSources: unknown;
  aiModel: string | null;
  aiGeneratedAt: Date | null;
};

/** トピックに保存されたまとめ記事を、表示用に検証して取り出す。未作成・不正な場合は null */
export function readAiArticle(t: TopicAiFields): AiArticle | null {
  if (!t.aiTitle || !t.aiGeneratedAt || !t.aiBody) return null;
  const points = PointsSchema.safeParse(t.aiPoints);
  const sources = SourcesSchema.safeParse(t.aiSources);
  if (!points.success || !sources.success) return null;
  return {
    title: t.aiTitle,
    lead: t.aiLead ?? "",
    body: t.aiBody.split(/\n{2,}/).filter(Boolean),
    points: points.data,
    sourceIds: sources.data,
    model: t.aiModel,
    generatedAt: t.aiGeneratedAt,
  };
}
