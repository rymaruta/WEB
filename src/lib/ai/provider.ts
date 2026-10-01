import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { buildStoryPrompt, STORY_SYSTEM } from "@/lib/stories/prompt";
import { StoryAnalysisSchema, type StoryAnalysis, type StoryMaterial } from "@/lib/stories/schema";

/**
 * ストーリー解析を行う AI の差し替え口。ニュースの取得・照合・保存は、この型だけを知っている。
 * 新しい AI を使うときは、この interface を実装したクラスを追加し、getStoryProvider に登録する。
 */
export interface AIProvider {
  readonly name: string;
  analyzeStory(materials: StoryMaterial[]): Promise<{ analysis: StoryAnalysis | null; model: string }>;
}

/** Anthropic API（Claude）。構造化出力で形式を固定する */
export class ClaudeProvider implements AIProvider {
  readonly name = "claude";
  private client: Anthropic | null = null;

  constructor(private readonly model = process.env.STORY_AI_MODEL ?? process.env.AI_MODEL ?? "claude-opus-5-5") {}

  async analyzeStory(materials: StoryMaterial[]) {
    this.client ??= new Anthropic();
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 16000,
      // 方針に触れて断られた場合は、API 側で適切なモデルに自動で切り替える
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(StoryAnalysisSchema) },
      system: STORY_SYSTEM,
      messages: [{ role: "user", content: buildStoryPrompt(materials) }],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      return { analysis: null, model: response.model };
    }
    return { analysis: response.parsed_output ?? null, model: response.model };
  }
}

/**
 * 使う AI を環境変数 STORY_AI_PROVIDER で選ぶ。
 * - "claude": サーバーが Anthropic API を呼ぶ（ANTHROPIC_API_KEY が必要、従量課金）
 * - 未設定・"external": サーバーは解析しない。外部（Claude Code の定期実行など）が
 *   /api/admin/stories/pending で資料を受け取り、/api/admin/stories/{id} に結果を送る
 */
export function getStoryProvider(): AIProvider | null {
  switch (process.env.STORY_AI_PROVIDER) {
    case "claude":
      return process.env.ANTHROPIC_API_KEY ? new ClaudeProvider() : null;
    default:
      return null;
  }
}
