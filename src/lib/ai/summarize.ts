import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { prisma } from "@/lib/db";
import { ArticleSchema, buildPrompt, sanitizeArticle, SYSTEM, type GeneratedArticle } from "./prompt";

/**
 * 複数の媒体が報じたトピックについて、各媒体の見出しと要約だけを材料に AI がまとめ記事を書く。
 * ANTHROPIC_API_KEY が未設定の場合は何もしない。
 */

const MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
/** この媒体数以上が報じたトピックだけを対象にする */
const MIN_PUBLISHERS = Number(process.env.AI_MIN_PUBLISHERS ?? 3);
/** 1回の収集で作成する最大本数（費用の上限管理） */
const MAX_PER_RUN = Number(process.env.AI_MAX_PER_RUN ?? 5);
/** 材料にする記事の最大数 */
const MAX_SOURCES = 12;
/** 失敗・見送り後に再試行するまでの時間 */
const RETRY_AFTER_MS = 6 * 3_600_000;
/** 作り直す場合も、前回からこの時間は空ける */
const REGENERATE_AFTER_MS = 2 * 3_600_000;

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** 資料（プロンプト）からまとめ記事を生成する関数。テストでは差し替える */
export type ArticleGenerator = (prompt: string) => Promise<{ article: GeneratedArticle | null; model: string }>;

let client: Anthropic | null = null;

const generateWithClaude: ArticleGenerator = async (prompt) => {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // 方針に触れて断られた場合は、API 側で適切なモデルに自動で切り替える
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(ArticleSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    return { article: null, model: response.model };
  }
  return { article: response.parsed_output ?? null, model: response.model };
};

export type SummarizeResult = { generated: number; skipped: number; failed: number };

/**
 * 対象トピックのまとめ記事を作成・更新する。
 * @param deadline この時刻を過ぎたら新しい生成を始めない（関数の実行時間制限への対策）
 */
export async function summarizeTopics(
  deadline: number,
  generate: ArticleGenerator | null = aiEnabled() ? generateWithClaude : null,
): Promise<SummarizeResult> {
  const result: SummarizeResult = { generated: 0, skipped: 0, failed: 0 };
  if (!generate) return result;

  const now = Date.now();
  const candidates = await prisma.topic.findMany({
    where: {
      lastSeenAt: { gte: new Date(now - 24 * 3_600_000) },
      publisherCount: { gte: MIN_PUBLISHERS },
      OR: [{ aiAttemptedAt: null }, { aiAttemptedAt: { lt: new Date(now - REGENERATE_AFTER_MS) } }],
    },
    orderBy: { score: "desc" },
    take: MAX_PER_RUN * 4,
    select: { id: true, publisherCount: true, aiGeneratedAt: true, aiAttemptedAt: true, aiSourceCount: true },
  });

  const due = candidates.filter((t) => {
    if (!t.aiGeneratedAt) {
      // 未作成。前回失敗・見送りなら一定時間あける
      return !t.aiAttemptedAt || now - t.aiAttemptedAt.getTime() > RETRY_AFTER_MS;
    }
    // 作成済み。報じる媒体が増えたときだけ作り直す
    return t.publisherCount > t.aiSourceCount;
  });

  for (const topic of due.slice(0, MAX_PER_RUN)) {
    if (Date.now() > deadline) break;
    const articles = await prisma.article.findMany({
      where: { topicId: topic.id },
      orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
      select: { id: true, publisher: true, publishedAt: true, title: true, summary: true, source: { select: { kind: true } } },
    });
    // 同じ媒体の記事は最初の1本だけを材料にする
    const seen = new Set<string>();
    const sources = articles
      .filter((a) => (seen.has(a.publisher) ? false : (seen.add(a.publisher), true)))
      .slice(0, MAX_SOURCES)
      .map((a) => ({ ...a, kind: a.source.kind }));

    await prisma.topic.update({ where: { id: topic.id }, data: { aiAttemptedAt: new Date() } });
    try {
      const { article, model } = await generate(buildPrompt(sources));
      const clean = article && sanitizeArticle(article, sources.length);
      if (!clean) {
        result.skipped++;
        continue;
      }
      await prisma.topic.update({
        where: { id: topic.id },
        data: {
          aiTitle: clean.title,
          aiLead: clean.lead,
          aiBody: clean.body.join("\n\n"),
          aiPoints: clean.points,
          aiSources: sources.map((s) => s.id),
          aiModel: model,
          aiGeneratedAt: new Date(),
          aiSourceCount: topic.publisherCount,
        },
      });
      result.generated++;
    } catch (e) {
      result.failed++;
      console.error(`AI まとめ記事の生成に失敗 (topic ${topic.id}):`, e instanceof Error ? e.message : e);
    }
  }
  return result;
}
