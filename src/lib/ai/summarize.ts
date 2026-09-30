import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ArticleSchema, buildPrompt, sanitizeArticle, SYSTEM, type GeneratedArticle } from "./prompt";
import { findDueTopics, loadTopicSources, markAttempted, saveArticle } from "./store";

/**
 * 複数の媒体が報じたトピックについて、各媒体の見出しと要約だけを材料に AI がまとめ記事を書く。
 * ANTHROPIC_API_KEY が未設定の場合は何もしない。
 */

const MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";
/** 1回の収集で作成する最大本数（費用の上限管理） */
const MAX_PER_RUN = Number(process.env.AI_MAX_PER_RUN ?? 5);

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

  for (const topic of await findDueTopics(MAX_PER_RUN)) {
    if (Date.now() > deadline) break;
    const sources = await loadTopicSources(topic.id);
    await markAttempted(topic.id);
    try {
      const { article, model } = await generate(buildPrompt(sources));
      const clean = article && sanitizeArticle(article, sources.length);
      if (!clean) {
        result.skipped++;
        continue;
      }
      await saveArticle(topic.id, clean, sources.map((s) => s.id), model);
      result.generated++;
    } catch (e) {
      result.failed++;
      console.error(`AI まとめ記事の生成に失敗 (topic ${topic.id}):`, e instanceof Error ? e.message : e);
    }
  }
  return result;
}
