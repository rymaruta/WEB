import { z } from "zod";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { publisherLabel } from "@/lib/publisher";
import { GameSchema, verifyGame, type GameInfo } from "./game";

/**
 * ゲームの発売日を、1媒体だけが報じた記事からも集める。
 * 1. 見出し・要約で候補を絞る（無料・その場で）: 「発売」「リリース」「延期」などと日付があり、グッズ・くじ・体験版・セールなどではないもの
 * 2. 候補だけを、記事作成の定期処理（Claude Code）が判定する（/api/admin/games/pending → /api/admin/games/{id}）
 * 3. タイトルと日付が資料に書かれているかを照合し、合っているものだけ保存する（verifyGame）
 */

const RELEASE_RE = /発売|リリース|配信開始|サービス開始|正式サービス|延期/;
const DATE_RE = /\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2}|\d{1,2}月(上旬|中旬|下旬|末)?|\d{4}年|本日|明日|今春|今夏|今秋|今冬|来春|来夏|来秋|来冬|来年/;
/** ゲーム本体の発売ではないもの */
const EXCLUDE_RE =
  /グッズ|ガシャポン|ガチャガチャ|一番くじ|くじ|フィギュア|アクスタ|アクリル|ぬいぐるみ|キーホルダー|コラボカフェ|カフェ|メニュー|ドリンク|サウンドトラック|サントラ|画集|設定資料|書籍|コミカライズ|小説|体験版|デモ版|セール|割引|無料配布|プライム感謝祭|ハンバーガー|バーガー|イベント開催|展示|ライブ配信|生放送/;

export function isGameReleaseCandidate(text: string): boolean {
  const t = text.normalize("NFKC");
  return RELEASE_RE.test(t) && DATE_RE.test(t) && !EXCLUDE_RE.test(t);
}

/** 候補を探す範囲（最初の報道からの日数） */
const CANDIDATE_DAYS = 30;

/** まだ確かめていない、ゲームの発売に関する候補の話題（新しい順） */
export async function findGameCandidates(limit: number, now = new Date()) {
  const topics = await prisma.topic.findMany({
    where: {
      genre: { slug: "game" },
      firstSeenAt: { gte: new Date(now.getTime() - CANDIDATE_DAYS * 86_400_000) },
      // まだ確かめていないもの。作品をまとめる呼び名（aiGameKey）がない読み取り済みのものも、呼び名を付けるために読み直す
      OR: [{ aiGameChecked: false }, { aiGameTitle: { not: null }, aiGameKey: null }],
    },
    orderBy: { firstSeenAt: "desc" },
    take: 400,
    select: { id: true, title: true, articles: { take: 3, orderBy: { publishedAt: "asc" }, select: { title: true, summary: true, publisher: true, publishedAt: true } } },
  });
  return topics
    .filter((t) => isGameReleaseCandidate([t.title, ...t.articles.map((a) => `${a.title} ${a.summary ?? ""}`)].join(" ")))
    .slice(0, limit);
}

export const GameExtractSchema = z.object({
  isGameRelease: z
    .boolean()
    .describe("ゲーム本体の発売・発売日の決定・発売日の延期・新作の発表を報じている資料なら true。グッズ・くじ・コラボ商品・書籍・体験版・セール・アップデートや追加コンテンツ（DLC）・イベントの記事は false"),
  game: GameSchema.nullable().describe("isGameRelease が true のときの情報。false なら null"),
});
export type GameExtract = z.infer<typeof GameExtractSchema>;

export const GAME_EXTRACT_SYSTEM = `あなたはゲームニュースの編集者です。資料（記事の見出しと短い要約）だけを根拠に、ゲーム本体の発売に関する情報を読み取ります。
- 資料に書かれていることだけを使う。タイトル・日付・機種を推測しない。
- タイトルは資料に書かれている表記のまま（『』や「」は付けない）。ゲーム機・技術・サービス・会社の名前は作品ではないので、isGameRelease を false にする。
- titleKey には、同じ作品を見分けるための日本語の通称をカタカナと数字で書く（例: ACE COMBAT 8 → エースコンバット8）。
- 発売日は資料に書かれている精度で書く（日まで→YYYY-MM-DD、月まで→YYYY-MM、年だけ→YYYY）。「今秋」「来年」のように月が書かれていなければ年だけにするか null にする。年が書かれていない「11月20日」は、記事の日付から見て次に来る11月20日の年を使う。
- 延期の報道は、新しい発売日を書く。
- 噂・リーク・関係者情報は kind を rumor にする。
- グッズ・くじ・コラボ商品・書籍・体験版・セール・アップデートや追加コンテンツ・イベントは isGameRelease を false にする。`;

export function buildGamePrompt(articles: { publisher: string; publishedAt: Date; title: string; summary: string | null }[]) {
  const lines = articles.map((a, i) => `[${i + 1}] ${publisherLabel(a.publisher)}／${formatDateTime(a.publishedAt)}\n見出し: ${a.title}\n要約: ${a.summary ?? "（なし）"}`);
  return `次の資料から、ゲーム本体の発売に関する情報を読み取ってください。\n\n${lines.join("\n\n")}`;
}

/**
 * 判定の結果を保存する。資料と照合して、タイトルが書かれていなければ使わない。発売日は資料に書かれているものだけ残す。
 * AI まとめ記事ですでに読み取った情報がある話題は、上書きしない。
 */
export async function saveGameExtract(topicId: number, result: GameExtract): Promise<{ saved: GameInfo | null }> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { aiGameTitle: true, aiGameKey: true, articles: { select: { title: true, summary: true } } },
  });
  if (!topic) throw new Error("topic not found");
  const corpus = topic.articles.map((a) => `${a.title}\n${a.summary ?? ""}`).join("\n");
  const game = result.isGameRelease ? verifyGame(result.game, corpus) : null;
  const key = game?.titleKey?.trim() || null;
  if (topic.aiGameTitle && !result.isGameRelease) {
    // 読み直して、ゲーム本体の発売の話題ではなかった（技術・ハードウェアの発表など）→ 発売スケジュール・新着ゲームから外す
    await prisma.topic.update({
      where: { id: topicId },
      data: { aiGameChecked: true, aiGameTitle: null, aiGameKey: null, aiGameRelease: null, aiGameKind: null, aiGamePlatforms: [] },
    });
    return { saved: null };
  }
  if (topic.aiGameTitle) {
    // 読み取り済みの情報は上書きしない。作品をまとめる呼び名だけ足す
    await prisma.topic.update({ where: { id: topicId }, data: { aiGameChecked: true, ...(key && !topic.aiGameKey ? { aiGameKey: key } : {}) } });
    return { saved: null };
  }
  await prisma.topic.update({
    where: { id: topicId },
    data: {
      aiGameChecked: true,
      aiGameTitle: game?.title ?? null,
      aiGameKey: key,
      aiGameRelease: game?.releaseDate ?? null,
      aiGameKind: game?.kind ?? null,
      aiGamePlatforms: game?.platforms ?? [],
    },
  });
  return { saved: game };
}
