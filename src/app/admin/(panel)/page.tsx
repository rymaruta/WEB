import Link from "next/link";
import { prisma } from "@/lib/db";
import { autoApproveEnabled, jstDate, jstDateLabel, jstTime, SLOT_ORDER, SLOTS } from "@/lib/digest/slots";
import { buildAction } from "../actions";

const STATUS: Record<string, { label: string; className: string }> = {
  // おまかせ投稿では、下書きは人が触らなくても時刻に投稿される
  DRAFT: { label: autoApproveEnabled() ? "自動で投稿予定" : "承認待ち", className: "border-amber-500 text-amber-700 dark:text-amber-400" },
  APPROVED: { label: "承認済み", className: "border-emerald-600 text-emerald-700 dark:text-emerald-400" },
  PUBLISHED: { label: "投稿済み", className: "border-fg-subtle text-fg-muted" },
  SKIPPED: { label: "見送り", className: "border-fg-subtle text-fg-subtle" },
  FAILED: { label: "失敗", className: "border-accent text-accent" },
};

function remaining(to: Date, now: Date) {
  const min = Math.round((to.getTime() - now.getTime()) / 60_000);
  if (min <= 0) return "締め切りを過ぎました";
  return min >= 60 ? `締め切りまで ${Math.floor(min / 60)} 時間 ${min % 60} 分` : `締め切りまで ${min} 分`;
}

export default async function AdminHome() {
  const now = new Date();
  const today = jstDate(now);
  const tomorrow = jstDate(new Date(now.getTime() + 86_400_000));
  const editions = await prisma.edition.findMany({
    where: { date: { in: [today, tomorrow] }, slot: { not: "BREAKING" } },
    include: { items: { select: { storyId: true, confirmed: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  const reviewIds = new Set(
    (
      await prisma.story.findMany({
        where: { id: { in: editions.flatMap((e) => e.items.map((i) => i.storyId)) }, status: "REVIEW_REQUIRED" },
        select: { id: true },
      })
    ).map((s) => s.id),
  );
  const missing = SLOT_ORDER.filter((slot) => !editions.some((e) => e.date === today && e.slot === slot) && now.getTime() < Date.parse(`${today}T${SLOTS[slot].publishAt}:00+09:00`));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">配信 <span className="text-sm font-bold text-fg-muted">{jstDateLabel(today)}</span></h1>
      {editions.length === 0 && <p className="text-sm text-fg-muted">今日の配信回はまだありません。下書きは 06:10・11:10・19:10 に自動で作られます。</p>}
      <ul className="space-y-3">
        {editions.map((e) => {
          const st = STATUS[e.status] ?? STATUS.DRAFT;
          const needs = e.items.filter((i) => reviewIds.has(i.storyId) && !i.confirmed).length;
          return (
            <li key={e.id}>
              <Link href={`/admin/editions/${e.id}`} className="block card p-4 hover:border-accent">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold">
                    {SLOTS[e.slot as keyof typeof SLOTS].title}
                    <span className="ml-2 text-sm font-bold text-fg-muted tabular-nums">
                      {e.date === today ? "" : "明日 "}
                      {jstTime(e.scheduledAt)}
                    </span>
                  </span>
                  <span className={`rounded border px-2 py-0.5 text-xs font-bold ${st.className}`}>{st.label}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-fg-muted">
                  <span>{e.items.length} 本</span>
                  {needs > 0 && <span className="font-bold text-accent">要確認 {needs} 本</span>}
                  {e.status === "DRAFT" && <span>{remaining(e.deadlineAt, now)}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {missing.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-bold">下書きを今すぐ作る</h2>
          <div className="flex flex-wrap gap-2">
            {missing.map((slot) => (
              <form key={slot} action={buildAction.bind(null, slot)}>
                <button type="submit" className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:border-accent">
                  {SLOTS[slot].title}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
