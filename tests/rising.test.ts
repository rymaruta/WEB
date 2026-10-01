import { describe, expect, it } from "vitest";
import { countReports, diversifyRising } from "@/lib/topics/rising";

const SPORTS = 1;
const IT = 2;
const ECONOMY = 3;

// 実際に急上昇が同じ試合の記事で埋まったときの見出し
const match = [
  "森保一監督、PK戦の順番は「俊輔コーチの提案を…」、助言についても言及「自信になるアドバイスだった」",
  "塩貝健人、PK戦で出番なし 試合後に森保監督へ直接質問",
  "PK戦でエクアドル撃破の日本代表、森保監督がW杯基準の戦いに手応え「この経験を糧に勝てるチームにしたい」",
  "唯一の連続先発！ 瀬古歩夢が示した安定感と次代を担う覚悟「相手の特徴を見ながらしっかり対応できた」",
  "日本代表が決勝へ！ “主将”堂安律「タイトルはすべて獲りたい。それがサッカー選手、日本代表としての使命」",
  "「とにかく思い切り蹴った」前田大然のPKが日本代表を勝利に導く！ 約2年ぶりの“凱旋”に「PKの時も歓声がすごかった」",
  "PKストップの鈴木彩艶、勝敗分け目のセーブは「先に動くことを意識」…アジアカップ見据え「臨機応変に対応」",
];

const item = (id: number, title: string, genreId: number, rise = 3, score = 1) => ({ id, title, genreId, rise, score });

describe("diversifyRising", () => {
  it("同じジャンルは2件まで、同じ試合の記事は1件だけにする", () => {
    const list = [
      item(1, "ガーナ代表のケイロス監督が退任 再任から約1カ月", SPORTS, 3, 5),
      ...match.map((t, i) => item(10 + i, t, SPORTS, 3, 4 - i * 0.1)),
      item(30, "日銀、追加利上げを決定 政策金利0.75%に", ECONOMY, 2.5),
      item(31, "iPhone 18の予約開始 アップル", IT, 2.5),
    ];
    const out = diversifyRising(list, 10);
    expect(out.filter((c) => c.genreId === SPORTS)).toHaveLength(2);
    expect(out.map((c) => c.id)).toEqual([1, 10, 30, 31]);
  });

  it("伸びが同じなら話題の大きい方を上にする", () => {
    const out = diversifyRising([item(1, "台風10号が上陸", 4, 3, 1), item(2, "新型スマホ発表", IT, 3, 9)], 10);
    expect(out.map((c) => c.id)).toEqual([2, 1]);
  });

  it("見出しが似ている話題は、同じジャンルの枠が残っていても1件にする", () => {
    const out = diversifyRising(
      [item(1, "日本代表、エクアドルにPK戦で勝利", SPORTS, 4), item(2, "日本代表がPK戦でエクアドル撃破", SPORTS, 3), item(3, "大谷翔平が50号本塁打", SPORTS, 2)],
      10,
    );
    expect(out.map((c) => c.id)).toEqual([1, 3]);
  });
});

describe("countReports", () => {
  const since = new Date("2026-10-01T22:00:00+09:00");
  const at = (hhmm: string) => new Date(`2026-10-01T${hhmm}:00+09:00`);
  const title = "「とにかく思い切り蹴った」前田大然のPKが日本代表を勝利に導く！";

  it("同じ見出しの転載は、媒体が違っても1つの報道として数える", () => {
    const c = countReports(
      [
        { topicId: 1, publisher: "soccer-king.jp", first: at("23:34"), title },
        { topicId: 1, publisher: "news.mynavi.jp", first: at("23:34"), title: `${title} - マイナビニュース` },
      ],
      since,
    ).get(1)!;
    expect(c).toEqual({ recent: 1, before: 0, publishers: 2 });
  });

  it("別々に書かれた記事は、それぞれ1つの報道として数える", () => {
    const c = countReports(
      [
        { topicId: 1, publisher: "a", first: at("22:10"), title: "日本代表、エクアドルにPK戦で勝利" },
        { topicId: 1, publisher: "b", first: at("22:30"), title: "日本代表がPK戦制しキリンカップ決勝へ" },
        { topicId: 1, publisher: "c", first: at("20:00"), title: "日本代表、エクアドル戦の先発発表" },
      ],
      since,
    ).get(1)!;
    expect(c).toEqual({ recent: 2, before: 1, publishers: 2 });
  });
});
