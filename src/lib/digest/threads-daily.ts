import { siteConfig } from "@/config/site";
import { readAiArticle } from "@/lib/ai/article";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyOwner } from "@/lib/notify";
import { createThreadsPost, THREADS_MAX_CHARS, threadsConfigured, threadsToken } from "@/lib/social/threads";
import type { Assessment } from "@/lib/stories/schema";
import { jstDate } from "./slots";

/**
 * Threads への1日1本の投稿「今日いちばん知っておきたいニュース」。
 * Threads は落ち着いた、丁寧な投稿が読まれるため、X の見出しの羅列は使い回さず、
 * その日 X に載せたニュースから1本だけ選び、AI まとめ記事の要点を添えて投稿する。
 * - 選ぶ対象: 今日の定時配信・速報に載り、AI まとめ記事があるもの（事実の照合を通った要点だけを使う）
 * - 事件・訃報は「知っておきたい」の形に合わないため選ばない
 * - 話題の大きさ（Story.score）の最も大きいもの
 */
export const THREADS_DAILY = {
  at: "21:00",
  maxPoints: 3,
  excludedRisks: ["CRIME", "DEATH"],
  settingKey: "threads.daily",
} as const;

export function threadsDailyText(article: { title: string; points: { text: string }[] }, publishers: number): string {
  const build = (n: number) =>
    [
      "今日いちばん知っておきたいニュース",
      "",
      article.title,
      "",
      ...article.points.slice(0, n).map((p) => `・${p.text}`),
      "",
      `${publishers}媒体の報道をもとにまとめました`,
    ].join("\n");
  for (let n = Math.min(THREADS_DAILY.maxPoints, article.points.length); n >= 1; n--) {
    const text = build(n);
    if ([...text].length <= THREADS_MAX_CHARS) return text;
  }
  return build(1).slice(0, THREADS_MAX_CHARS);
}

/** 今日の1本を選ぶ。なければ null */
export async function pickThreadsDaily(date: string) {
  const items = await prisma.editionItem.findMany({
    where: { role: "MAIN", edition: { date, status: "PUBLISHED" } },
    select: { story: { select: { score: true, riskFlags: true, assessment: true, topic: true } } },
  });
  const candidates = items
    .map((i) => i.story)
    .filter((s) => !s.riskFlags.some((r) => (THREADS_DAILY.excludedRisks as readonly string[]).includes(r)))
    .filter((s) => {
      const a = s.assessment as Assessment | null;
      return !a?.gossip && !a?.promotional;
    })
    .map((s) => ({ score: s.score, topic: s.topic, article: readAiArticle(s.topic) }))
    .filter((c) => c.article && c.article.points.length > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0] ?? null;
}

type Stored = { date: string; topicId: number; postId: string };

/** 毎日 THREADS_DAILY.at に呼ぶ。今日の分を投稿済みなら何もしない */
export async function runThreadsDaily(now = new Date()) {
  if (!threadsConfigured()) return { result: "not-configured" as const };
  const date = jstDate(now);
  const row = await prisma.setting.findUnique({ where: { key: THREADS_DAILY.settingKey } });
  const stored = row?.value as Stored | undefined;
  if (stored?.date === date) return { result: "already-published" as const, postId: stored.postId };

  const pick = await pickThreadsDaily(date);
  if (!pick || !pick.article) {
    await logEvent("info", "threads.daily", `${date}: Threads に載せるニュースがないため見送りました`);
    return { result: "none" as const };
  }
  const text = threadsDailyText(pick.article, pick.topic.publisherCount);
  const link = `${siteConfig.url}/topic/${pick.topic.id}`;
  try {
    const token = await threadsToken();
    if (!token) throw new Error("Threads のアクセストークンが設定されていません");
    const postId = await createThreadsPost(token, text, link);
    const value: Stored = { date, topicId: pick.topic.id, postId };
    await prisma.setting.upsert({ where: { key: THREADS_DAILY.settingKey }, create: { key: THREADS_DAILY.settingKey, value }, update: { value } });
    await logEvent("info", "threads.daily", `${date}: Threads に投稿しました（${pick.article.title}）`, undefined, { topicId: pick.topic.id, postId });
    return { result: "published" as const, postId, topicId: pick.topic.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await logEvent("error", "threads.daily", `${date}: Threads への投稿に失敗`, undefined, { message });
    await notifyOwner({
      title: "Threads への投稿に失敗しました",
      what: `今日の「いちばん知っておきたいニュース」を Threads に投稿できませんでした。X の投稿には影響ありません。`,
      action: "続くようであれば、Threads のアクセストークンが有効か確認してください。",
      detail: message.slice(0, 300),
    });
    return { result: "failed" as const, error: message };
  }
}
