import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildJmaItem, fetchJmaItems, intensityLabel, intensityValue, parseJmaFeed, wantedEntry } from "@/lib/jma";

const fx = (name: string) => readFileSync(`${__dirname}/fixtures/jma/${name}`, "utf8");
const URL = "https://www.data.jma.go.jp/developer/xml/data/20261007142557_0_VXSE53_270000.xml";

describe("気象庁の防災情報", () => {
  it("高頻度フィードの項目を読む", () => {
    const entries = parseJmaFeed(fx("eqvol.xml"));
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.filter((e) => wantedEntry(e.title)).map((e) => e.title)).toContain("震源・震度に関する情報");
    expect(wantedEntry("降灰予報（定時）")).toBe(false);
  });

  it("震度の表記", () => {
    expect(intensityValue("5-")).toBe(5);
    expect(intensityValue("5+")).toBe(5.5);
    expect(intensityValue("4")).toBe(4);
    expect(intensityValue("x")).toBeNull();
    expect(intensityLabel("6+")).toBe("6強");
  });

  it("最大震度4以上の地震を記事にする（震源・震度・規模・津波の有無）", () => {
    const item = buildJmaItem(fx("vxse53-5lower.xml"), URL)!;
    expect(item.kind).toBe("earthquake");
    expect(item.title).toBe("熊本県熊本地方で最大震度5弱の地震（M2.6）　津波の心配なし");
    expect(item.summary).toContain("各地の最大震度：熊本県 5弱");
    expect(item.url).toContain("20261007142557_0_VXSE53_270000");
    expect(item.intensity).toBe(5);
    expect(item.publishedAt.toISOString()).toBe("2026-10-07T14:25:00.000Z");
  });

  it("震度の小さい地震は記事にしない", () => {
    expect(buildJmaItem(fx("vxse53-1.xml"), URL)).toBeNull();
  });

  it("取消の電文は記事にしない", () => {
    expect(buildJmaItem(fx("vxse53-5lower.xml").replace("<InfoType>発表</InfoType>", "<InfoType>取消</InfoType>"), URL)).toBeNull();
  });

  it("津波警報・注意報は記事にし、予報だけのものは記事にしない", () => {
    const tsunami = (headline: string) =>
      `<Report><Control><Title>津波警報・注意報・予報a</Title></Control><Head><Title>津波警報・注意報・予報</Title><ReportDateTime>2026-10-07T23:30:00+09:00</ReportDateTime><InfoType>発表</InfoType><Headline><Text>${headline}</Text></Headline></Head><Body></Body></Report>`;
    expect(buildJmaItem(tsunami("津波警報を発表しました。"), URL)?.title).toBe("津波警報を発表");
    expect(buildJmaItem(tsunami("大津波警報・津波警報を発表しました。"), URL)?.title).toBe("大津波警報を発表");
    expect(buildJmaItem(tsunami("津波注意報を解除しました。"), URL)?.title).toBe("津波注意報を解除");
    expect(buildJmaItem(tsunami("津波予報（若干の海面変動）を発表しています。"), URL)).toBeNull();
  });

  it("一覧と電文を読み、記事を新しい順に返す（読めない電文は飛ばす）", async () => {
    const fetchImpl = async (url: string) => {
      if (url.endsWith("eqvol.xml")) return new Response(fx("eqvol.xml"));
      if (url.includes("VXSE53")) return new Response(fx("vxse53-5lower.xml"));
      return new Response("", { status: 500 });
    };
    const items = await fetchJmaItems(fetchImpl as typeof fetch);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === "earthquake")).toBe(true);
  });
});
