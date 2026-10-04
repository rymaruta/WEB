import { prisma } from "@/lib/db";

/**
 * 予定の変更の記録（ゲーム・映画・アニメ）。取り込みのたびに、前回の一覧と今回の一覧を比べて残す。
 * - 日付が変わった予定（延期・前倒し）: 前の日付 → 新しい日付
 * - 一覧から外れたこれからの予定: 新しい日付は null（延期で日付未定・中止・掲載終了など。情報源に理由は書かれていないので、理由は書かない）
 * 情報源の表記をそのまま比べるだけで、AI は使わない
 */

export type ScheduleKind = "game" | "movie" | "anime";
export type ScheduleEntry = { key: string; title: string; date: string };
export type ScheduleDiff = { title: string; oldDate: string; newDate: string | null };

export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = { game: "ゲーム", movie: "映画", anime: "アニメ" };

/** 題名の表記の揺れ（空白・全角半角）を除いて比べる */
const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

/**
 * 前回と今回の一覧を比べる。key はその予定を見分ける値（ゲームはストアの ID、映画・アニメは題名）。
 * 比べるのは、前回の時点でこれから（today 以降）だった予定だけ（過ぎた予定が一覧から消えるのは変更ではない）
 */
export function diffSchedule(before: ScheduleEntry[], after: ScheduleEntry[], today: string): ScheduleDiff[] {
  const now = new Map<string, ScheduleEntry[]>();
  for (const a of after) now.set(norm(a.key), [...(now.get(norm(a.key)) ?? []), a]);
  const out: ScheduleDiff[] = [];
  const seen = new Set<string>();
  for (const b of before) {
    if (b.date.slice(0, b.date.length) < today.slice(0, b.date.length)) continue;
    const id = `${norm(b.key)}|${b.date}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const matches = now.get(norm(b.key)) ?? [];
    if (matches.some((m) => m.date === b.date)) continue;
    // 同じ予定の別の日付があれば、日付の変更。なければ一覧から外れた
    const moved = matches.find((m) => m.date >= today.slice(0, m.date.length)) ?? matches[0];
    out.push({ title: b.title, oldDate: b.date, newDate: moved?.date ?? null });
  }
  return out;
}

/** 変更を記録する。同じ変更（同じ予定・同じ日付の組み合わせ）は重ねて記録しない */
export async function recordScheduleChanges(kind: ScheduleKind, diffs: ScheduleDiff[], sourceUrl: string | null, now = new Date()) {
  let saved = 0;
  for (const d of diffs) {
    const dup = await prisma.scheduleChange.findFirst({ where: { kind, title: d.title, oldDate: d.oldDate, newDate: d.newDate } });
    if (dup) continue;
    await prisma.scheduleChange.create({ data: { kind, title: d.title, oldDate: d.oldDate, newDate: d.newDate, sourceUrl, detectedAt: now } });
    saved++;
  }
  return saved;
}

/** 最近の予定の変更（新しい順） */
export function getRecentScheduleChanges(days = 30, now = new Date()) {
  return prisma.scheduleChange.findMany({
    where: { detectedAt: { gte: new Date(now.getTime() - days * 86_400_000) } },
    orderBy: { detectedAt: "desc" },
    take: 50,
    select: { kind: true, title: true, oldDate: true, newDate: true, sourceUrl: true, detectedAt: true },
  });
}

/** 分野ごとの、最後に情報源で確かめた日時（カレンダーの「最終確認」） */
export async function getScheduleCheckedAt(): Promise<Record<ScheduleKind, Date | null>> {
  const [game, movie, anime] = await Promise.all([
    prisma.gameListing.aggregate({ _max: { checkedAt: true } }),
    prisma.movieListing.aggregate({ _max: { checkedAt: true } }),
    prisma.animeListing.aggregate({ _max: { checkedAt: true } }),
  ]);
  return { game: game._max.checkedAt, movie: movie._max.checkedAt, anime: anime._max.checkedAt };
}
