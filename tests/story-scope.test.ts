import { describe, expect, it } from "vitest";
import { getStoryScope } from "@/lib/ai/provider";

const KEY = "sk-ant-test";

describe("getStoryScope", () => {
  it("キーがなければサーバーは解析しない", () => expect(getStoryScope({})).toBeNull());
  it("仮の値はキーとして扱わない", () => expect(getStoryScope({ ANTHROPIC_API_KEY: "ここにキーを貼る" })).toBeNull());
  it("キーだけなら、速報になりうる出来事だけを解析する", () => expect(getStoryScope({ ANTHROPIC_API_KEY: KEY })).toBe("hot"));
  it("claude ならすべて、external なら解析しない", () => {
    expect(getStoryScope({ ANTHROPIC_API_KEY: KEY, STORY_AI_PROVIDER: "claude" })).toBe("all");
    expect(getStoryScope({ ANTHROPIC_API_KEY: KEY, STORY_AI_PROVIDER: "external" })).toBeNull();
  });
});
