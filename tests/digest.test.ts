import { describe, expect, it } from "vitest";
import {
  altText,
  beforeLabel,
  buildBreakingCard,
  buildCards,
  composePostText,
  joinHeadline,
  replyText,
  sourcesLine,
  splitParts,
  type EditionEntry,
} from "@/lib/digest/compose";
import { isAutoReviewable, scoreCandidate, selectForEdition, type Candidate } from "@/lib/digest/select";
import { editionKey, jstAt, jstDate, jstDateLabel, jstFullDateLabel, jstPostDate, jstTime, msUntilJst, SLOTS } from "@/lib/digest/slots";
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
    expect(jstFullDateLabel("2026-10-01")).toBe("2026年10月1日（木）");
    expect(jstPostDate("2026-10-02")).toBe("10/2(金)");
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

describe("selectForEdition（3つの枠）", () => {
  const ids = (r: { main: { id: string }[]; followups: { id: string }[] }) => [...r.main, ...r.followups].map((m) => m.id);

  it("社会・政治・経済・国際／暮らし・テック・科学／スポーツ・芸能 の各枠から1本ずつ", () => {
    const hard = [cand({ category: "ECONOMY" }), cand({ category: "WORLD", publisherCount: 2 })];
    const life = [cand({ category: "TECH" }), cand({ category: "LIFE", publisherCount: 2 })];
    const soft = [cand({ category: "SPORTS" }), cand({ category: "ENTERTAINMENT", publisherCount: 2 })];
    const r = selectForEdition([...soft, ...life, ...hard], SLOTS.MORNING, new Set());
    expect(r.main.map((m) => m.id)).toEqual([hard[0].id, life[0].id, soft[0].id]);
    expect(r.notes.frames).toEqual({ hard: hard[0].id, life: life[0].id, soft: soft[0].id });
  });

  it("候補のない枠は、ほかの枠の2番手で埋める（まだ使っていない分野を優先）。必ず3本", () => {
    const econ = [cand({ category: "ECONOMY" }), cand({ category: "ECONOMY" })];
    const world = cand({ category: "WORLD", publisherCount: 2 });
    const sports = cand({ category: "SPORTS" });
    const r = selectForEdition([...econ, world, sports], SLOTS.MORNING, new Set());
    expect(r.main).toHaveLength(3);
    expect(ids(r)).toContain(world.id);
    expect(r.notes.frames?.life).toBeNull();
  });

  it("ほかに候補がなければ、同じ分野でも3本にする", () => {
    const sports = [cand({ category: "SPORTS" }), cand({ category: "SPORTS" }), cand({ category: "SPORTS" })];
    expect(selectForEdition(sports, SLOTS.MORNING, new Set()).main).toHaveLength(3);
  });

  it("基準点に届かない候補は、ほかに候補がないときだけ使う", () => {
    const low = cand({ category: "LIFE", publisherCount: 2, assessment: assess({ impact: 0, longevity: 0 }) });
    const r = selectForEdition([cand({ category: "ECONOMY" }), cand({ category: "SPORTS" }), low], SLOTS.MORNING, new Set());
    expect(r.main).toHaveLength(3);
    expect(r.notes.filled).toBe(1);
  });

  it("ゴシップ・宣伝（基準点未満）と同じ出来事の2本目は使わない", () => {
    const a = cand({ category: "ECONOMY" });
    const same = cand({ category: "WORLD", threadId: a.threadId });
    const promo = cand({ category: "LIFE", assessment: assess({ promotional: true, impact: 0, longevity: 0 }) });
    const gossip = cand({ category: "ENTERTAINMENT", assessment: assess({ gossip: true, impact: 0, longevity: 0, publicInterest: 0 }) });
    expect(ids(selectForEdition([a, same, promo, gossip], SLOTS.MORNING, new Set()))).toEqual([a.id]);
  });

  it("前の回に載った出来事は、もう一度は載せない", () => {
    const a = cand();
    const b = cand();
    const r = selectForEdition([a, b], SLOTS.MORNING, new Set([a.threadId!]));
    expect(ids(r)).toEqual([b.id]);
    expect(r.notes.excludedThreads).toBe(1);
  });

  it("除外・解析待ちは使わない。おまかせ投稿では、自動で使ってよい要確認だけ使う", () => {
    const review = cand({ status: "REVIEW_REQUIRED", category: "ECONOMY" });
    const reviewOk = cand({ status: "REVIEW_REQUIRED", category: "WORLD", autoOk: true });
    const others = [cand({ status: "REJECTED_AUTO" }), cand({ status: "QUEUED" })];
    expect(ids(selectForEdition([review, reviewOk, ...others], SLOTS.MORNING, new Set(), { verifiedOnly: true }))).toEqual([reviewOk.id]);
  });

  it("続報は新しい事実があり基準点以上のときだけ、同じ枠で競う（followupMax 本まで）", () => {
    const follow = cand({ kind: "FOLLOWUP", threadId: "tx", newFacts: 2, category: "ECONOMY", assessment: assess({ impact: 3, longevity: 3 }) });
    const noFacts = cand({ kind: "FOLLOWUP", threadId: "ty", newFacts: 0, category: "TECH", assessment: assess({ impact: 3, longevity: 3 }) });
    const r = selectForEdition([follow, noFacts, cand({ category: "ECONOMY" }), cand({ category: "LIFE" }), cand({ category: "SPORTS" })], { ...SLOTS.MORNING, followupMax: 1 }, new Set());
    expect(r.followups.map((f) => f.id)).toEqual([follow.id]);
    expect(ids(r)).not.toContain(noFacts.id);
    expect(ids(r)).toHaveLength(3);
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
  it("1行目は日付と回の名前、2行目以降は1本1行の見出し", () => {
    const es = [entry(), entry({ position: 2, headline: ["Googleが最新AI", "Gemini 4 Argon"] })];
    expect(composePostText("MORNING", "2026-10-02", es)).toEqual([
      "☀️ 10/2(金) 朝のニュース",
      "",
      "・ニデック、不正会計で6321億円の減損",
      "・Googleが最新AI Gemini 4 Argon",
      "",
      "画像をスワイプで詳しく👉",
    ]);
  });
  it("続報は「続報：」を付ける", () => {
    const es = [entry(), entry({ position: 2, role: "FOLLOWUP", headline: ["ホルムズ海峡", "通航が再開"] })];
    expect(composePostText("EVENING", "2026-10-01", es)).toEqual([
      "🌙 10/1(木) 夜のニュース",
      "",
      "・ニデック、不正会計で6321億円の減損",
      "・続報：ホルムズ海峡通航が再開",
      "",
      "画像をスワイプで詳しく👉",
    ]);
  });
  it("続報のカードの見出し（◯◯／結局どうなった）は「◯◯のその後」にする", () => {
    const es = [entry(), entry({ position: 2, role: "FOLLOWUP", headline: ["広島戦力外", "結局どうなった"] })];
    expect(composePostText("EVENING", "2026-10-02", es)[3]).toBe("・続報：広島戦力外のその後");
  });
  it("X の文字数上限（全角140字）に収まるよう、後ろの行を削る", () => {
    const es = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry({ position: p, headline: ["あいうえおかきくけこさし", "たちつてとなにぬねのはひ"] }));
    const text = composePostText("LUNCH", "2026-10-01", es);
    expect(text[0]).toBe("🕛 10/1(木) 昼のニュース");
    expect(text.length).toBeLessThan(9);
    expect(textWidth(text.join("\n"))).toBeLessThanOrEqual(LIMITS.postTotalWidth);
    for (const line of text) expect(textWidth(line)).toBeLessThanOrEqual(LIMITS.postWidth);
  });
  it("見出しの連結は英数字どうしの境目だけ空白を入れる", () => {
    expect(joinHeadline(["米Micronが", "過去最高の決算"])).toBe("米Micronが過去最高の決算");
    expect(joinHeadline(["Googleが最新AI", "Gemini 4"])).toBe("Googleが最新AI Gemini 4");
  });
});

describe("投稿の分け方", () => {
  it("1投稿で完結。INDEX＋上位3本のカード", () => {
    expect(splitParts(5)).toEqual([[0, 1, 2, 3]]);
    expect(splitParts(2)).toEqual([[0, 1, 2]]);
    expect(splitParts(0)).toEqual([]);
  });
  it("リプライの本文", () => {
    const es = [1, 2, 3, 4, 5].map((p) => entry({ position: p, role: p >= 5 ? "FOLLOWUP" : "MAIN" }));
    expect(replyText(es, [4, 5])).toBe("4本目と続報\nニデック、不正会計で6321億円の減損\n続報：ニデック、不正会計で6321億円の減損");
    expect(replyText(es.map((e) => ({ ...e, role: "MAIN" as const })), [4, 5]).split("\n")[0]).toBe("4・5本目");
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

describe("話題性と、要確認の自動掲載", () => {
  it("報じた媒体が多く、SNS の反応が大きいほど点数が高い", () => {
    const quiet = scoreCandidate(cand({ publisherCount: 2, social: 0 }));
    const buzzing = scoreCandidate(cand({ publisherCount: 8, social: 300 }));
    expect(buzzing.parts.buzz).toBeGreaterThan(quiet.parts.buzz);
    expect(buzzing.score).toBeGreaterThan(quiet.score + 10);
  });

  const base = { status: "REVIEW_REQUIRED", statusNote: "慎重に扱う分野: 事件", riskFlags: ["CRIME"], confidence: 0.9, publisherCount: 4, assessment: null };

  it("公式の発表を多くの媒体が報じ、理由が分野だけなら自動で載せてよい（例: 所属事務所の契約解除）", () => {
    expect(isAutoReviewable(base)).toBe(true);
  });

  it("食い違い・確からしさ・媒体数・訃報・ゴシップのどれかがあれば人が確かめる", () => {
    expect(isAutoReviewable({ ...base, statusNote: "慎重に扱う分野: 事件\n媒体間の食い違い: 人数" })).toBe(false);
    expect(isAutoReviewable({ ...base, confidence: 0.6 })).toBe(false);
    expect(isAutoReviewable({ ...base, publisherCount: 2 })).toBe(false);
    expect(isAutoReviewable({ ...base, riskFlags: ["DEATH"], statusNote: "慎重に扱う分野: 死亡" })).toBe(false);
    expect(isAutoReviewable({ ...base, assessment: assess({ gossip: true }) })).toBe(false);
    expect(isAutoReviewable({ ...base, status: "PENDING" })).toBe(false);
  });

  it("訃報・戦争・医療は、独立4社以上・信頼できる媒体あり・確からしさ0.85以上なら自動で使う", () => {
    const strict = { ...base, riskFlags: ["DEATH"], statusNote: "慎重に扱う分野: 死亡", publisherCount: 4, confidence: 0.9, trusted: true };
    expect(isAutoReviewable(strict)).toBe(true);
    expect(isAutoReviewable({ ...strict, trusted: false })).toBe(false);
    expect(isAutoReviewable({ ...strict, publisherCount: 3 })).toBe(false);
    expect(isAutoReviewable({ ...strict, confidence: 0.82 })).toBe(false);
  });

  it("事件で人名が出てくるもの（実名の容疑者など）は自動では使わない", () => {
    expect(isAutoReviewable({ ...base, riskFlags: ["CRIME"], statusNote: "慎重に扱う分野: 事件", hasPeople: true })).toBe(false);
    expect(isAutoReviewable({ ...base, riskFlags: ["CRIME"], statusNote: "慎重に扱う分野: 事件", hasPeople: false })).toBe(true);
  });

  it("おまかせ投稿の回でも、自動で載せてよい要確認のものは選ぶ", () => {
    const ok = cand({ status: "REVIEW_REQUIRED", autoOk: true, category: "ENTERTAINMENT" });
    const ng = cand({ status: "REVIEW_REQUIRED", autoOk: false, category: "SOCIETY" });
    const r = selectForEdition([ok, ng, cand({ category: "ECONOMY" }), cand({ category: "TECH" })], SLOTS.LUNCH, new Set(), { verifiedOnly: true });
    expect(r.main.map((m) => m.id)).toContain(ok.id);
    expect(r.main.map((m) => m.id)).not.toContain(ng.id);
  });
});
