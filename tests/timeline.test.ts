import { describe, expect, it } from "vitest";
import { pickAround } from "@/lib/topics/pick-around";

const list = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe("pickAround", () => {
  it("returns all entries when within the limit", () => {
    expect(pickAround(list(3), 2, 5).map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it("keeps the current entry near the middle", () => {
    expect(pickAround(list(20), 10, 4).map((e) => e.id)).toEqual([8, 9, 10, 11]);
  });

  it("clamps at both ends", () => {
    expect(pickAround(list(20), 1, 4).map((e) => e.id)).toEqual([1, 2, 3, 4]);
    expect(pickAround(list(20), 20, 4).map((e) => e.id)).toEqual([17, 18, 19, 20]);
  });
});
