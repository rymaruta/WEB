import { describe, expect, it } from "vitest";
import { pickHighlights } from "@/components/calendar-preview";

const it_ = (category: "game" | "anime" | "changes", title: string, href: string | null = null) => ({ date: "2026-10-02", category, title, note: null, href, external: false });

describe("pickHighlights", () => {
  it("ニュースになっているものを先にし、分野を順に取る", () => {
    const items = [it_("game", "G1"), it_("game", "G2"), it_("game", "G3"), it_("game", "G4"), it_("game", "G5", "/topic/1"), it_("anime", "A1"), it_("changes", "C1", "/topic/2")];
    expect(pickHighlights(items).map((x) => x.title)).toEqual(["G5", "C1", "A1", "G1"]);
  });
});
