import { describe, expect, it } from "vitest";
import { routineFireReady } from "@/lib/digest/routine";

describe("routineFireReady", () => {
  it("仮の値・未設定は未設定として扱う", () => {
    expect(routineFireReady({})).toBe(false);
    expect(routineFireReady({ ROUTINE_FIRE_TOKEN: "ここにトークンを貼る" })).toBe(false);
  });
  it("トークンが入っていれば使える", () => expect(routineFireReady({ ROUTINE_FIRE_TOKEN: "sk-ant-oat01-abcdefghijklmnopqrstuvwxyz" })).toBe(true));
});
