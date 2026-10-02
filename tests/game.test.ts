import { describe, expect, it } from "vitest";
import { releaseLabel, releaseSortKey, verifyDate, verifyGame } from "@/lib/game";

const src = "『モンスターハンターワイルズ』の大型アップデートが11月20日に配信。PS5とSteamで遊べる。2026年12月には新モンスターも";

describe("verifyGame", () => {
  it("資料にあるタイトルなら残す", () => {
    expect(verifyGame({ title: "モンスターハンターワイルズ", releaseDate: "2026-11-20", platforms: ["PS5", "PC"], kind: "update" }, src)?.releaseDate).toBe("2026-11-20");
  });
  it("資料にないタイトルは使わない", () => {
    expect(verifyGame({ title: "モンハン6", releaseDate: null, platforms: [], kind: "announce" }, src)).toBeNull();
  });
});

describe("verifyDate", () => {
  it("日付・月が資料に書かれていれば残す", () => {
    expect(verifyDate("2026-11-20", src)).toBe("2026-11-20");
    expect(verifyDate("2026-12", src)).toBe("2026-12");
  });
  it("資料にない日付は使わない", () => {
    expect(verifyDate("2026-11-21", src)).toBeNull();
    expect(verifyDate("2027-03", src)).toBeNull();
    expect(verifyDate("来年", src)).toBeNull();
  });
  it("資料に月までしかないのに日まで書いたときは、月までに落とす", () => {
    expect(verifyDate("2026-10-01", "鳥貴族が10月から値上げ")).toBe("2026-10");
    expect(verifyDate("2026-12-01", "ドコモが12月から最大550円値上げ")).toBe("2026-12");
  });
});

describe("年だけの発売予定と表示", () => {
  it("資料に年が書かれていれば残す", () => {
    expect(verifyDate("2027", "グランド・セフト・オートVIは2027年発売予定")).toBe("2027");
    expect(verifyDate("2028", "2027年発売予定")).toBeNull();
  });
  it("表示と並び順", () => {
    expect(releaseLabel("2026-11-20", 2026)).toBe("11月20日");
    expect(releaseLabel("2027-03", 2026)).toBe("2027年3月");
    expect(releaseLabel("2027", 2026)).toBe("2027年");
    expect(["2027", "2027-03", "2027-03-05"].sort((a, b) => releaseSortKey(a).localeCompare(releaseSortKey(b)))).toEqual(["2027-03-05", "2027-03", "2027"]);
  });
});
