import Link from "next/link";
import { prisma } from "@/lib/db";
import { jstDate } from "@/lib/digest/slots";
import { SLOTS, type Slot } from "@/lib/digest/slots";
import { SOURCE_LABELS, SOURCES, type TrafficSource } from "@/lib/traffic";
import { SearchConsoleSection } from "./search-console";

const DAYS = 14;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function daysBack(n: number): string[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => jstDate(new Date(now - i * 86_400_000)));
}

/** 数字（流入元・よく読まれたページ・配信の結果）。外部のサービスを開かずに毎日の様子が分かるようにする */
export default async function AnalyticsPage() {
  const days = daysBack(DAYS);
  const [today, yesterday] = days;
  const [traffic, pagesToday, pagesWeek, editions, feedback] = await Promise.all([
    prisma.trafficDaily.findMany({ where: { date: { in: days } } }),
    prisma.pageDaily.findMany({ where: { date: today }, orderBy: { views: "desc" }, take: 10 }),
    prisma.pageDaily.groupBy({ by: ["path"], where: { date: { in: days.slice(0, 7) } }, _sum: { views: true }, orderBy: { _sum: { views: "desc" } }, take: 10 }),
    prisma.edition.findMany({ where: { date: { in: days.slice(0, 7) }, slot: { not: "BREAKING" } }, select: { date: true, slot: true, status: true }, orderBy: { scheduledAt: "desc" } }),
    // 直近7日に評価があった記事（「分かりにくい」の多い順）
    prisma.topicFeedback.findMany({ where: { updatedAt: { gte: daysAgo(7) } }, orderBy: [{ unclear: "desc" }, { helpful: "desc" }], take: 50 }),
  ]);
  const fbTopics = await prisma.topic.findMany({ where: { id: { in: feedback.map((f) => f.topicId) } }, select: { id: true, aiTitle: true, title: true } });
  const fbTitle = new Map(fbTopics.map((t) => [t.id, t.aiTitle ?? t.title]));
  const fbHelpful = feedback.reduce((a, f) => a + f.helpful, 0);
  const fbUnclear = feedback.reduce((a, f) => a + f.unclear, 0);

  const byDay = new Map<string, Map<string, number>>();
  for (const t of traffic) {
    const m = byDay.get(t.date) ?? new Map<string, number>();
    m.set(t.source, t.views);
    byDay.set(t.date, m);
  }
  const total = (d: string) => [...(byDay.get(d)?.values() ?? [])].reduce((a, b) => a + b, 0);
  const totalToday = total(today);
  const totalYesterday = total(yesterday);
  const week = days.slice(0, 7);
  const weekBySource = SOURCES.map((s) => ({ s, v: week.reduce((a, d) => a + (byDay.get(d)?.get(s) ?? 0), 0) })).filter((x) => x.v > 0);
  const weekTotal = weekBySource.reduce((a, x) => a + x.v, 0);
  const max = Math.max(1, ...days.map(total));

  const posted = editions.filter((e) => e.status === "PUBLISHED").length;
  const skipped = editions.filter((e) => e.status === "SKIPPED" || e.status === "FAILED");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-extrabold">数字</h1>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-bold text-fg-muted">今日の訪問（サイトに入ってきた回数）</h2>
        <p className="text-3xl font-black tabular-nums">{totalToday.toLocaleString()}</p>
        <p className="text-xs text-fg-subtle">
          昨日 {totalYesterday.toLocaleString()}
          {totalYesterday > 0 && `（${totalToday >= totalYesterday ? "+" : ""}${Math.round(((totalToday - totalYesterday) / totalYesterday) * 100)}%）`}
          ・今日は 0 時からの合計
        </p>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-bold text-fg-muted">流入元（直近7日）</h2>
        {weekTotal === 0 ? (
          <p className="text-sm text-fg-subtle">まだ記録がありません。</p>
        ) : (
          <ul className="space-y-2">
            {weekBySource
              .sort((a, b) => b.v - a.v)
              .map(({ s, v }) => (
                <li key={s}>
                  <div className="flex justify-between text-sm">
                    <span>{SOURCE_LABELS[s as TrafficSource]}</span>
                    <span className="tabular-nums">
                      {v.toLocaleString()}（{Math.round((v / weekTotal) * 100)}%）
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-surface-muted">
                    <div className="h-2 rounded bg-accent" style={{ width: `${(v / weekTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-bold text-fg-muted">訪問の推移（直近{DAYS}日）</h2>
        <ul className="space-y-1">
          {days.map((d) => (
            <li key={d} className="flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0 tabular-nums text-fg-muted">{d.slice(5).replace("-", "/")}</span>
              <div className="h-3 flex-1 rounded bg-surface-muted">
                <div className="h-3 rounded bg-accent/70" style={{ width: `${(total(d) / max) * 100}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums">{total(d).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <SearchConsoleSection />

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-bold text-fg-muted">よく見られたページ</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { title: "今日", rows: pagesToday.map((p) => ({ path: p.path, v: p.views })) },
            { title: "直近7日", rows: pagesWeek.map((p) => ({ path: p.path, v: p._sum.views ?? 0 })) },
          ].map(({ title, rows }) => (
            <div key={title}>
              <h3 className="mb-1 text-xs font-bold">{title}</h3>
              {rows.length === 0 ? (
                <p className="text-xs text-fg-subtle">まだ記録がありません。</p>
              ) : (
                <ol className="space-y-1 text-xs">
                  {rows.map((r) => (
                    <li key={r.path} className="flex justify-between gap-2">
                      <Link href={r.path} className="truncate text-accent hover:underline">
                        {r.path}
                      </Link>
                      <span className="tabular-nums">{r.v.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-bold text-fg-muted">記事への評価（直近7日）</h2>
        <p className="text-sm">
          役に立った <strong className="tabular-nums">{fbHelpful}</strong> ／ 分かりにくい <strong className="tabular-nums">{fbUnclear}</strong>
        </p>
        {feedback.filter((f) => f.unclear > 0).length > 0 && (
          <>
            <h3 className="mt-3 mb-1 text-xs font-bold">「分かりにくい」が多い記事</h3>
            <ol className="space-y-1 text-xs">
              {feedback
                .filter((f) => f.unclear > 0)
                .slice(0, 10)
                .map((f) => (
                  <li key={f.topicId} className="flex justify-between gap-2">
                    <Link href={`/topic/${f.topicId}`} className="truncate text-accent hover:underline">
                      {fbTitle.get(f.topicId) ?? `#${f.topicId}`}
                    </Link>
                    <span className="shrink-0 tabular-nums text-fg-muted">
                      分かりにくい {f.unclear}・役に立った {f.helpful}
                    </span>
                  </li>
                ))}
            </ol>
          </>
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-bold text-fg-muted">X への配信（直近7日）</h2>
        <p className="text-sm">
          投稿 <strong className="tabular-nums">{posted}</strong> 回 ／ 見送り・失敗 <strong className="tabular-nums">{skipped.length}</strong> 回
        </p>
        {skipped.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-fg-muted">
            {skipped.map((e) => (
              <li key={`${e.date}-${e.slot}`}>
                {e.date} {SLOTS[e.slot as Slot]?.title ?? e.slot}：{e.status === "FAILED" ? "失敗" : "見送り"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-fg-subtle">
        訪問は、ページが開かれたときにブラウザーから届く記録を日ごとに合計したものです。個人を特定できる情報は保存していません。
      </p>
    </div>
  );
}
