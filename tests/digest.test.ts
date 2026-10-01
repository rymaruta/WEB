import { describe, expect, it } from "vitest";
import {
  altText,
  beforeLabel,
  buildBreakingCard,
  buildCards,
  composePostText,
  replyText,
  sourcesLine,
  splitParts,
  type EditionEntry,
} from "@/lib/digest/compose";
import { scoreCandidate, selectForEdition, type Candidate } from "@/lib/digest/select";
import { editionKey, jstAt, jstDate, jstDateLabel, jstTime, msUntilJst, SLOTS } from "@/lib/digest/slots";
import { pickFollowupMaterials } from "@/lib/stories/materials";
import { LIMITS, type Assessment, type FollowupAnalysis, type StoryMaterial } from "@/lib/stories/schema";
import { textWidth } from "@/lib/stories/text";
import { verifyFollowup } from "@/lib/stories/verify";

describe("日本時間の扱い", () => {
  it("UTC の夜は、日本時間では翌日", () => {
    expect(jstDate(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10-01");
    expect(jstAt("2026-10-01", "07:00").toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });
  it("表示用の日付と時刻", () => {
    expect(jstDateLabel("2026-10-01")).toBe("10月1日（木）");
    expect(jstTime(new Date("2026-09-30T22:00:00Z"))).toBe("7:00");
  });
  it("次の時刻までの待ち時間。過ぎていれば翌日", () => {
    const now = new Date("2026-09-30T21:00:00Z"); // 6:00 JST
    expect(msUntilJst("06:10", now)).toBe(10 * 60_000);
    expect(msUntilJst("05:00", now)).toBe(23 * 3_600_000);
  });
  it("配信回の鍵", () => {
    expect(editionKey("2026-10-01", "MORNING")).toBe("2026-10-01:MORNING");
    expect(editionKey("2026-10-01", "BREAKING", "s1")).toBe("2026-10-01:BREAKING:s1");
  });
});

const assess = (o: Partial<Assessment> = {}): Assessment => ({
  impact: 2,
  longevity: 2,
  publicInterest: 2,
  actionable: false,
  gossip: false,
  promotional: false,
  ...o,
});

let seq = 0;
const cand = (o: Partial<Candidate> = {}): Candidate => ({
  id: `s${++seq}`,
  kind: "NEW",
  status: "PENDING",
  category: "TECH",
  threadId: `t${seq}`,
  assessment: assess(),
  publisherCount: 3,
  hasPrimary: false,
  confidence: 0.9,
  clicks: 0,
  ...o,
});

describe("選定の点数", () => {
  it("媒体数や閲覧数より、影響の大きさを重く見る", () => {
    const big = scoreCandidate(cand({ assessment: assess({ impact: 3, longevity: 3 }), publisherCount: 2 }));
    const buzz = scoreCandidate(cand({ assessment: assess({ impact: 0, longevity: 0 }), publisherCount: 5, clicks: 5000 }));
    expect(big.score).toBeGreaterThan(buzz.score);
  });
  it("ゴシップと宣伝は大きく減点する", () => {
    const normal = scoreCandidate(cand());
    expect(scoreCandidate(cand({ assessment: assess({ gossip: true }) })).score).toBeLessThan(normal.score - 30);
    expect(scoreCandidate(cand({ assessment: assess({ promotional: true }) })).score).toBeLessThan(normal.score - 15);
  });
});

describe("selectForEdition", () => {
  it("朝は5本。同じカテゴリーは2本まで", () => {
    const cs = [...Array.from({ length: 4 }, () => cand({ category: "TECH" })), cand({ category: "ECONOMY" }), cand({ category: "WORLD" }), cand({ category: "SOCIETY" })];
    const r = selectForEdition(cs, SLOTS.MORNING, new Set());
    expect(r.main).toHaveLength(5);
    const byId = new Map(cs.map((c) => [c.id, c]));
    expect(r.main.filter((m) => byId.get(m.id)!.category === "TECH")).toHaveLength(2);
  });

  it("芸能とスポーツは合わせて1本まで", () => {
    const cs = [cand({ category: "ENTERTAINMENT" }), cand({ category: "SPORTS" }), cand({ category: "ECONOMY" })];
    const r = selectForEdition(cs, SLOTS.MORNING, new Set());
    expect(r.main).toHaveLength(2);
  });

  it("ゴシップは本数が足りなくても載せない", () => {
    const cs = [cand({ category: "ECONOMY" }), cand({ category: "ENTERTAINMENT", assessment: assess({ gossip: true, impact: 0, longevity: 0, publicInterest: 0 }) })];
    const r = selectForEdition(cs, SLOTS.MORNING, new Set());
    expect(r.main.map((m) => m.id)).toEqual([cs[0].id]);
    expect(r.notes.belowMinScore).toBe(1);
  });

  it("朝は政治・経済・国際を1本以上入れる（候補があれば入れ替える）", () => {
    const tech = Array.from({ length: 2 }, () => cand({ category: "TECH", assessment: assess({ impact: 3, longevity: 3 }) }));
    const sci = Array.from({ length: 2 }, () => cand({ category: "SCIENCE", assessment: assess({ impact: 3, longevity: 3 }) }));
    const life = cand({ category: "LIFE", assessment: assess({ impact: 3, longevity: 3 }) });
    const econ = cand({ category: "ECONOMY", assessment: assess({ impact: 1, longevity: 1 }) });
    const r = selectForEdition([...tech, ...sci, life, econ], SLOTS.MORNING, new Set());
    expect(r.main).toHaveLength(5);
    expect(r.main.map((m) => m.id)).toContain(econ.id);
  });

  it("前の回に載った出来事は、もう一度は載せない", () => {
    const a = cand();
    const b = cand();
    const r = selectForEdition([a, b], SLOTS.LUNCH, new Set([a.threadId!]));
    expect(r.main.map((m) => m.id)).toEqual([b.id]);
    expect(r.notes.excludedThreads).toBe(1);
  });

  it("要確認・除外・解析待ちの扱い", () => {
    const review = cand({ status: "REVIEW_REQUIRED" });
    const rejected = cand({ status: "REJECTED_AUTO" });
    const queued = cand({ status: "QUEUED" });
    const r = selectForEdition([review, rejected, queued], SLOTS.LUNCH, new Set());
    expect(r.main.map((m) => m.id)).toEqual([review.id]);
  });

  it("夜は本編4本＋続報2本。続報の出来事は本編に重ねない", () => {
    const followA = cand({ kind: "FOLLOWUP", threadId: "tx", newFacts: 1, category: "ECONOMY" });
    const mainA = cand({ threadId: "tx", category: "ECONOMY" });
    const followB = cand({ kind: "FOLLOWUP", newFacts: 2, category: "WORLD" });
    const others = [cand({ category: "WORLD" }), cand({ category: "TECH" }), cand({ category: "SCIENCE" }), cand({ category: "LIFE" }), cand({ category: "POLITICS" })];
    const r = selectForEdition([followA, mainA, followB, ...others], SLOTS.EVENING, new Set());
    expect(r.followups.map((f) => f.id).sort()).toEqual([followA.id, followB.id].sort());
    expect(r.main).toHaveLength(4);
    expect(r.main.map((m) => m.id)).not.toContain(mainA.id);
  });

  it("夜は今日配信した出来事（PUBLISHED）も、まとめとして候補にできる", () => {
    const morning = cand({ status: "PUBLISHED", category: "ECONOMY" });
    expect(selectForEdition([morning], SLOTS.EVENING, new Set()).main.map((m) => m.id)).toEqual([morning.id]);
  });

  it("夜に続報がなければ、本編を5本まで増やす", () => {
    const cs = [cand({ category: "WORLD" }), cand({ category: "TECH" }), cand({ category: "SCIENCE" }), cand({ category: "LIFE" }), cand({ category: "POLITICS" }), cand({ category: "ECONOMY" })];
    expect(selectForEdition(cs, SLOTS.EVENING, new Set()).main).toHaveLength(5);
  });
});

const entry = (o: Partial<EditionEntry> = {}): EditionEntry => ({
  position: 1,
  role: "MAIN",
  category: "ECONOMY",
  headline: ["ニデック、不正会計で", "6321億円の減損"],
  shortTitle: "ニデック 6321億円減損",
  keyword: "ニデック決算",
  points: [
    { text: "前期決算で巨額の減損損失を計上", sources: [1] },
    { text: "監査法人は「意見不表明」", sources: [1] },
    { text: "不正会計を受け資産を精査", sources: [2] },
  ],
  why: null,
  delta: null,
  publishers: ["東洋経済オンライン", "日本経済新聞", "ロイター"],
  firstSeenAt: new Date("2026-09-30T23:30:00Z"),
  ...o,
});

describe("投稿文", () => {
  it("1行目は回の名前と本数、2行目は上位2本のキーワード。各行20字以内", () => {
    const es = [entry({ keyword: "ホルムズ海峡" }), entry({ position: 2 }), entry({ position: 3, keyword: "Windows" })];
    const text = composePostText("MORNING", es);
    expect(text).toEqual(["☀️ 朝これだけ（3本）", "ホルムズ海峡・ニデック決算ほか"]);
    for (const line of text) expect(textWidth(line)).toBeLessThanOrEqual(LIMITS.postWidth);
  });
  it("夜に続報があれば、2行目で「その後」を知らせる", () => {
    const es = [entry(), entry({ position: 2, role: "FOLLOWUP", keyword: "ホルムズ海峡" })];
    expect(composePostText("EVENING", es)).toEqual(["🌙 今日これだけ（1本＋続報1）", "ホルムズ海峡のその後も"]);
  });
  it("長すぎるキーワードは数を減らして20字に収める", () => {
    const es = [entry({ keyword: "あいうえおかきくけ" }), entry({ position: 2, keyword: "さしすせそたちつて" }), entry({ position: 3 })];
    const [, second] = composePostText("LUNCH", es);
    expect(second).toBe("あいうえおかきくけほか");
  });
});

describe("投稿の分け方", () => {
  it("1投稿は画像4枚まで。5本なら INDEX＋3枚と、残り2枚のリプライ", () => {
    expect(splitParts(5)).toEqual([
      [0, 1, 2, 3],
      [4, 5],
    ]);
    expect(splitParts(3)).toEqual([[0, 1, 2, 3]]);
    expect(splitParts(6)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6],
    ]);
  });
  it("リプライの本文", () => {
    const es = [1, 2, 3, 4, 5].map((p) => entry({ position: p, role: p >= 5 ? "FOLLOWUP" : "MAIN" }));
    expect(replyText(es, [4, 5])).toBe("4本目と続報");
    expect(replyText(es.map((e) => ({ ...e, role: "MAIN" as const })), [4, 5])).toBe("4・5本目");
  });
});

describe("カード", () => {
  const view = {
    slot: "EVENING" as const,
    date: "2026-10-01",
    scheduledAt: jstAt("2026-10-01", "20:00"),
    entries: [
      entry({ why: { text: "決算の信頼性に保証がない", sources: [1] } }),
      entry({ position: 2, category: "WORLD", shortTitle: "ホルムズ海峡 再開案" }),
      entry({
        position: 3,
        role: "FOLLOWUP",
        headline: ["ニデック決算", "結局どうなった"],
        shortTitle: "ニデック 会見で説明",
        delta: { before: "6321億円の減損を計上", now: { text: "社長が会見で経緯を説明", sources: [1] }, previousAt: jstAt("2026-10-01", "07:00") },
      }),
    ],
  };
  const cards = buildCards(view);

  it("1枚目は INDEX、続いて掲載順のカード", () => {
    expect(cards.map((c) => c.type)).toEqual(["INDEX", "NEWS", "NEWS", "FOLLOWUP"]);
  });
  it("「なぜ重要」があるカードは、要点を2つにする", () => {
    const first = cards[1];
    expect(first.type === "NEWS" && first.points).toHaveLength(2);
    const second = cards[2];
    expect(second.type === "NEWS" && second.points).toHaveLength(3);
  });
  it("カードの上の帯に何枚目か、下の帯に日付と時刻", () => {
    const c = cards[2];
    expect(c.type === "NEWS" && [c.counter, c.stamp]).toEqual(["2/2", "10/1 20:00"]);
  });
  it("続報カードは前回の時点を、読者に分かる言葉で示す", () => {
    const c = cards[3];
    expect(c.type === "FOLLOWUP" && c.beforeLabel).toBe("朝の時点");
    expect(beforeLabel(jstAt("2026-09-30", "20:00"), "2026-10-01")).toBe("昨夜の時点");
  });
  it("代替テキストにカードの文字をすべて入れる", () => {
    expect(altText(cards[0])).toContain("1. ［経済］ニデック 6321億円減損");
    expect(altText(cards[0])).toContain("［続報］ニデック 会見で説明");
    expect(altText(cards[1])).toContain("なぜ重要：決算の信頼性に保証がない");
    expect(altText(cards[3])).toContain("現在：社長が会見で経緯を説明");
  });
  it("出典は媒体名を2つまで", () => {
    expect(sourcesLine(["A", "B", "C", "C"])).toBe("出典：A・B ほか1");
    expect(sourcesLine(["A"])).toBe("出典：A");
  });
  it("速報カードは「◯時◯分時点」と、分かっていないことを書く", () => {
    const b = buildBreakingCard(entry(), new Date("2026-10-01T01:42:00Z"), "停電の原因");
    expect(b.asOf).toBe("10:42 時点");
    expect(b.points).toHaveLength(2);
    expect(altText(b)).toContain("まだ分かっていないこと：停電の原因");
  });
});

describe("続報", () => {
  const published = new Date("2026-09-30T22:00:00Z");
  const art = (id: number, publisher: string, minutes: number, isPrimary = false) => ({
    id,
    publisher,
    isPrimary,
    publishedAt: new Date(published.getTime() + minutes * 60_000),
  });
  const none = new Set<number>();

  it("配信後に2媒体以上が報じたら続報の候補にする", () => {
    expect(pickFollowupMaterials([art(1, "A", -30), art(2, "B", 30), art(3, "C", 60)], published, none)?.map((a) => a.id)).toEqual([2, 3]);
  });
  it("1媒体だけなら候補にしない（公式発表なら1つでよい）", () => {
    expect(pickFollowupMaterials([art(1, "A", -30), art(2, "B", 30), art(3, "B", 60)], published, none)).toBeNull();
    expect(pickFollowupMaterials([art(2, "企業", 30, true)], published, none)).not.toBeNull();
  });
  it("前回の資料に使った記事は、配信後の日時でも新しい記事として数えない", () => {
    expect(pickFollowupMaterials([art(2, "B", 30), art(3, "C", 60)], published, new Set([2, 3]))).toBeNull();
  });

  const materials: StoryMaterial[] = [
    { position: 1, publisher: "日本経済新聞", publishedAt: new Date("2026-10-01T06:00:00Z"), title: "ニデック社長が会見、不正会計の経緯を説明", summary: "再発防止策も示した。", isPrimary: false },
  ];
  const previous = { keyword: "ニデック決算", headline: ["ニデック、不正会計で", "6321億円の減損"], summary: "6321億円の減損損失を計上した。", points: ["監査法人は「意見不表明」"], publishedAt: published };
  const base: FollowupAnalysis = {
    sufficient: true,
    newFacts: [{ text: "社長が会見で経緯を説明", sources: [1] }],
    before: "6321億円の減損を計上",
    now: { text: "社長が会見、再発防止策も示す", sources: [1] },
    shortTitle: "ニデック 会見で説明",
    confidence: 0.9,
  };

  it("新しい事実があり、照合で問題がなければ配信の候補", () => {
    const r = verifyFollowup(base, materials, previous);
    expect(r.notes).toEqual([]);
    expect(r.status).toBe("PENDING");
  });
  it("新しい事実がなければ自動で除外（同じニュースを繰り返さない）", () => {
    expect(verifyFollowup({ ...base, newFacts: [] }, materials, previous).status).toBe("REJECTED_AUTO");
  });
  it("「前回の時点」は前回の内容と、「現在」は新しい資料と照合する", () => {
    const r = verifyFollowup({ ...base, before: "7000億円の減損を計上", now: { text: "社長が10日に辞任", sources: [1] } }, materials, previous);
    expect(r.status).toBe("REVIEW_REQUIRED");
    expect(r.missingFacts).toEqual(expect.arrayContaining(["7000", "10"]));
  });
});

describe("出典の媒体名", () => {
  it("ドメイン名は読者に分かる名前にする", () => {
    expect(sourcesLine(["yomiuri.co.jp", "www.cnn.co.jp", "BBCニュース"])).toBe("出典：読売新聞・CNN ほか1");
  });
});
