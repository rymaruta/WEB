import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { buildFollowupPrompt, buildStoryPrompt, FOLLOWUP_SYSTEM, STORY_SYSTEM } from "@/lib/stories/prompt";
import {
  FollowupAnalysisSchema,
  StoryAnalysisSchema,
  type FollowupAnalysis,
  type PreviousCoverage,
  type StoryAnalysis,
  type StoryMaterial,
} from "@/lib/stories/schema";

/**
 * ストーリー解析を行う AI の差し替え口。ニュースの取得・照合・保存は、この型だけを知っている。
 * 新しい AI を使うときは、この interface を実装したクラスを追加し、getStoryProvider に登録する。
 */
export interface AIProvider {
  readonly name: string;
  analyzeStory(materials: StoryMaterial[]): Promise<{ analysis: StoryAnalysis | null; model: string }>;
  analyzeFollowup(previous: PreviousCoverage, materials: StoryMaterial[]): Promise<{ analysis: FollowupAnalysis | null; model: string }>;
}

/** Anthropic API（Claude）。構造化出力で形式を固定する */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  private client: Anthropic | null = null;

  constructor(private readonly model = process.env.STORY_AI_MODEL ?? process.env.AI_MODEL ?? "claude-opus-5-5") {}

  private async parse<T extends z.ZodType>(schema: T, system: string, prompt: string) {
    this.client ??= new Anthropic();
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // 方針に触れて断られた場合は、API 側で適切なモデルに自動で切り替える
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return { analysis: null, model: response.model };
    }
    return { analysis: (response.parsed_output ?? null) as z.infer<T> | null, model: response.model };
  }

  analyzeStory(materials: StoryMaterial[]) {
    return this.parse(StoryAnalysisSchema, STORY_SYSTEM, buildStoryPrompt(materials));
  }

  analyzeFollowup(previous: PreviousCoverage, materials: StoryMaterial[]) {
    return this.parse(FollowupAnalysisSchema, FOLLOWUP_SYSTEM, buildFollowupPrompt(previous, materials));
  }
}

/**
 * サーバーで AI 解析する範囲。環境変数 STORY_AI_PROVIDER と ANTHROPIC_API_KEY で決まる。
 * - "claude": すべての解析待ちをサーバーが解析する（従量課金）
 * - 未設定でキーがある: 速報になりうる出来事（src/lib/stories/hot.ts）だけをサーバーがすぐ解析する。
 *   ほかは外部（Claude Code の定期実行）が /api/admin/stories/pending で資料を受け取り、結果を送る
 * - "external"・キーがない: サーバーは解析しない
 */
export type StoryScope = "all" | "hot";

/** キーが入っているか（Parameter Store に置いた仮の値「ここにキーを貼る」などは、キーとして扱わない） */
export const hasAnthropicKey = (env: Record<string, string | undefined> = process.env) => /^sk-ant-/.test(env.ANTHROPIC_API_KEY ?? "");

export function getStoryScope(env: Record<string, string | undefined> = process.env): StoryScope | null {
  if (!hasAnthropicKey(env)) return null;
  if (env.STORY_AI_PROVIDER === "claude") return "all";
  if (env.STORY_AI_PROVIDER === "external") return null;
  return "hot";
}

/** 速報の解析に使う既定のモデル（件数が少なく、急ぐため。STORY_AI_MODEL で変えられる） */
const HOT_MODEL = "claude-sonnet-5-5";

export function getStoryProvider(scope = getStoryScope()): AIProvider | null {
  if (!scope) return null;
  return scope === "hot" ? new ClaudeProvider(process.env.STORY_AI_MODEL ?? HOT_MODEL) : new ClaudeProvider();
}
