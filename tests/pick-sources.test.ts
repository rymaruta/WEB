import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { pickSources } from "@/lib/ai/store";

const a = (id: number, publisher: string, hour: number, title = `見出し${id}`) => ({ id, publisher, publishedAt: new Date(Date.UTC(2026, 9, 1, hour)), title });

describe("pickSources（まとめ記事の材料）", () => {
  it("長く続く話題でも、第一報と最新の報道を必ず材料に入れる", () => {
    // 20媒体が順に報じ、最後の3本は同じ媒体の続報
    const articles = [...Array.from({ length: 20 }, (_, i) => a(i + 1, `媒体${i + 1}`, i)), a(21, "媒体1", 21, "続報：辞任は否定"), a(22, "媒体2", 22, "続報：発言を認める")];
    const picked = pickSources(articles, 12);
    expect(picked).toHaveLength(12);
    expect(picked[0].id).toBe(1);
    expect(picked.map((p) => p.id)).toEqual(expect.arrayContaining([21, 22]));
    // 古い順に並べて返す
    expect(picked.map((p) => p.publishedAt.getTime())).toEqual([...picked.map((p) => p.publishedAt.getTime())].sort((x, y) => x - y));
  });
  it("同じ見出しの転載は1本と数える", () => {
    const picked = pickSources([a(1, "A", 1, "同じ見出し"), a(2, "B", 2, "同じ見出し"), a(3, "C", 3, "別の見出し")], 12);
    expect(picked.map((p) => p.id)).toEqual([1, 3]);
  });
  it("記事が少なければすべて使う", () => {
    expect(pickSources([a(1, "A", 1), a(2, "B", 2)], 12).map((p) => p.id)).toEqual([1, 2]);
  });
});
