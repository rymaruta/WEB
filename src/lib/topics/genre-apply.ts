import { prisma } from "@/lib/db";
import { confidentMove, judgeGenre } from "./genre-rules";

/**
 * 話題単位のジャンルの見直し（ルール層）。記事の多数決で決まった話題のジャンルを、話題の見出しと要約で確かめる。
 * - AI がまだ見ていない話題：ルールの信頼度が TOPIC_MIN_CONFIDENCE 以上なら、ルールのジャンルにする
 * - AI が見た話題：AI の判定を優先する。ただしルールが強く食い違う（OVERRIDE_AI_CONFIDENCE 以上）ときは、いったんルールの
 *   ジャンルにして、AI にもう一度だけ見てもらう（recheck）。見直した AI の判定（ai-final）は、それ以降ルールで変えない
 * どちらも、決めた方法・信頼度・根拠を genreNote に残す（誤分類の調査と精度の測定に使う）。既存の記事・話題は消さない
 *
 * genreNote の先頭の語:
 * - rule / vote: ルール層が決めた（vote は信頼度が低く、記事の多数決のまま）
 * - ai: AI が決めた / ai+rule: AI とルールが一致
 * - recheck: ルールが AI と強く食い違ったため、AI の見直し待ち
 * - ai-final: 見直した AI の判定（確定）
 */
export const TOPIC_MIN_CONFIDENCE = 0.4;
/** AI の判定の見直しを頼む下限（手がかり2つ以上で、この信頼度以上） */
export const OVERRIDE_AI_CONFIDENCE = 0.7;

export type TopicRow = {
  id: number;
  title: string;
  genreSlug: string;
  aiGenreSlug: string | null;
  summary: string | null;
  publisher: string | null;
  /** 今の genreNote */
  note?: string | null;
};

export type TopicDecision = {
  genre: string;
  /** 新しい genreNote。null なら今のまま */
  note: string | null;
  /** AI に見直してもらう */
  recheck: boolean;
};

const startsWith = (note: string | null | undefined, word: string) => !!note && (note === word || note.startsWith(`${word} `));

/** 1件の判定（純粋な関数。テスト用） */
export function decideTopicGenre(t: TopicRow): TopicDecision {
  const current = t.aiGenreSlug ?? t.genreSlug;
  // 見直し待ちの間は動かさない（AI の結果が来てから決める）
  if (!t.aiGenreSlug && startsWith(t.note, "recheck")) return { genre: t.genreSlug, note: null, recheck: false };
  const j = judgeGenre(t.title, t.summary, current, t.publisher ?? undefined);
  const note = (method: string) => `${method} ${j.genre} conf=${j.confidence} ${j.reason}`.slice(0, 500);
  if (t.aiGenreSlug) {
    const aiNote = startsWith(t.note, "ai") || startsWith(t.note, "ai-final");
    if (!j.moved) return { genre: current, note: aiNote ? null : note("ai+rule"), recheck: false };
    if (j.evidence >= 2 && j.confidence >= OVERRIDE_AI_CONFIDENCE && !startsWith(t.note, "ai-final")) {
      return { genre: j.genre, note: note(`recheck ai=${t.aiGenreSlug}`), recheck: true };
    }
    return { genre: current, note: aiNote ? null : note(`ai=${t.aiGenreSlug} rule`), recheck: false };
  }
  // AI が「決めにくい」と答えた記録は残す（ジャンルはルールで決める）
  const keepAiNote = startsWith(t.note, "ai") || startsWith(t.note, "ai-final");
  return confidentMove(j, TOPIC_MIN_CONFIDENCE)
    ? { genre: j.genre, note: keepAiNote ? null : note("rule"), recheck: false }
    : { genre: current, note: keepAiNote ? null : note(j.moved ? "vote" : "rule"), recheck: false };
}

/** 直近 hours 時間に動きのあった話題のジャンルを見直す。dryRun なら変えずに、変わる件数と例を返す */
export async function applyTopicGenreRules(hours = 2, dryRun = false, limit = 2000, opts: { revote?: boolean } = {}) {
  // revote: 先に記事の多数決からジャンルを数え直す（ルールを変えたあと、前のルールで動かした話題を戻すため）
  if (opts.revote && !dryRun) {
    const { refreshTopics } = await import("./cluster");
    const ids = await prisma.topic.findMany({
      where: { lastSeenAt: { gte: new Date(Date.now() - hours * 3_600_000) }, mergedIntoId: null },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
      select: { id: true },
    });
    for (let i = 0; i < ids.length; i += 500) await refreshTopics(ids.slice(i, i + 500).map((t) => t.id));
  }
  const [genres, topics] = await Promise.all([
    prisma.genre.findMany({ select: { id: true, slug: true } }),
    prisma.topic.findMany({
      where: { lastSeenAt: { gte: new Date(Date.now() - hours * 3_600_000) }, mergedIntoId: null },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        genreId: true,
        aiGenreId: true,
        genreNote: true,
        articles: { where: { source: { kind: "NEWS" } }, orderBy: { publishedAt: "asc" }, take: 1, select: { summary: true, publisher: true } },
      },
    }),
  ]);
  const slugOf = new Map(genres.map((g) => [g.id, g.slug]));
  const idOf = new Map(genres.map((g) => [g.slug, g.id]));
  const changes: { id: number; from: string; to: string; title: string; note: string; recheck: boolean }[] = [];
  let noted = 0;
  for (const t of topics) {
    const row: TopicRow = {
      id: t.id,
      title: t.title,
      genreSlug: slugOf.get(t.genreId) ?? "domestic",
      aiGenreSlug: t.aiGenreId ? (slugOf.get(t.aiGenreId) ?? null) : null,
      summary: t.articles[0]?.summary ?? null,
      publisher: t.articles[0]?.publisher ?? null,
      note: t.genreNote,
    };
    const d = decideTopicGenre(row);
    const to = idOf.get(d.genre);
    if (!to) continue;
    if (to !== t.genreId || d.recheck) changes.push({ id: t.id, from: row.genreSlug, to: d.genre, title: t.title, note: d.note ?? "", recheck: d.recheck });
    if (dryRun) continue;
    if (d.recheck) {
      // 見直しは AI の判定を外して、もう一度候補に入れる（findGenreCheckCandidates は aiGenreId が空の話題だけを見る）
      await prisma.topic.update({ where: { id: t.id }, data: { genreId: to, genreNote: d.note, aiGenreId: null, aiGenreChecked: false } });
    } else if (to !== t.genreId || (d.note && d.note !== t.genreNote)) {
      await prisma.topic.update({ where: { id: t.id }, data: { genreId: to, ...(d.note ? { genreNote: d.note } : {}) } });
      if (to === t.genreId) noted++;
    }
  }
  return {
    checked: topics.length,
    changed: changes.length,
    recheck: changes.filter((c) => c.recheck).length,
    noted,
    dryRun,
    examples: changes.slice(0, 30).map((c) => `${c.from}→${c.to} ${c.title.slice(0, 40)} [${c.note.slice(0, 80)}]`),
  };
}
