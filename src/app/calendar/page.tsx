import type { Metadata } from "next";
import { CalendarView } from "@/components/calendar-view";
import { CALENDAR_CATEGORIES, CALENDAR_LABELS, getCalendar } from "@/lib/calendar";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { getRecentScheduleChanges, getScheduleCheckedAt, SCHEDULE_KIND_LABELS, type ScheduleKind } from "@/lib/schedule-changes";

/** 日付の表示（2026-11-01 → 11/1、2026-11 → 2026年11月） */
const shortDate = (d: string) => (d.length === 7 ? `${d.slice(0, 4)}年${Number(d.slice(5))}月` : `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`);
/** 終わった予定として振り返る日数 */
const PAST_DAYS = 7;

export const revalidate = 600;

export const metadata: Metadata = {
  title: "ぜんぶカレンダー｜ゲーム・アニメ・映画・新商品・値上げの予定が1つに",
  description:
    "ゲームの発売日、アニメの放送開始、映画の公開日、新商品の発売日、値上げや制度の変更を、1つのカレンダーにまとめました。分野で絞り込めて、スマホのカレンダーにも追加できます。",
  alternates: { canonical: "/calendar" },
};

export default async function CalendarPage() {
  const now = new Date();
  const [{ from, to, items }, past, changes, checked] = await Promise.all([
    getCalendar(now),
    // 終わった予定（直近 PAST_DAYS 日）。サイト内のページ（作品・話題）があるものだけ、その後のニュースへ案内する
    getCalendar(new Date(now.getTime() - PAST_DAYS * 86_400_000), PAST_DAYS).then((c) => c.items.filter((it) => it.href && !it.external).reverse()),
    getRecentScheduleChanges(30, now).catch(() => []),
    getScheduleCheckedAt().catch(() => ({ game: null, movie: null, anime: null }) as Record<ScheduleKind, Date | null>),
  ]);
  const counts = Object.fromEntries(CALENDAR_CATEGORIES.map((c) => [c, items.filter((it) => it.category === c).length]));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "ぜんぶカレンダー", path: "/calendar" },
            ]),
          ),
        }}
      />
      <header className="card p-5 sm:p-6">
        <h1 className="text-2xl font-black">ぜんぶカレンダー</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          これから始まるものを、分野をまたいで1つのカレンダーにまとめました。今日から{Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1}
          日間で全{items.length}件（{CALENDAR_CATEGORIES.filter((c) => counts[c] > 0)
            .map((c) => `${CALENDAR_LABELS[c]} ${counts[c]}件`)
            .join("、")}
          ）。
        </p>
      </header>
      <CalendarView items={items} counts={counts} />
      {changes.length > 0 && (
        <section className="card p-5" aria-labelledby="changes-heading">
          <h2 id="changes-heading" className="text-lg font-black">
            予定の変更（直近30日）
          </h2>
          <p className="mt-1 text-xs text-fg-subtle">取り込みのたびに前回の一覧と比べて記録しています。一覧から外れた理由（延期・中止・掲載終了など）は情報源に書かれていないため、情報源でご確認ください。</p>
          <ul className="mt-2 divide-y divide-border text-sm">
            {changes.map((c, i) => (
              <li key={i} className="py-2">
                <p className="text-xs text-fg-subtle">
                  {SCHEDULE_KIND_LABELS[c.kind as ScheduleKind] ?? c.kind}・{formatDateTime(c.detectedAt)}に確認
                </p>
                <p className="font-bold">{c.title}</p>
                <p className="text-[13px] text-fg-muted">
                  {c.newDate ? (
                    <>
                      {shortDate(c.oldDate)} → <strong className="text-fg">{shortDate(c.newDate)}</strong>
                    </>
                  ) : (
                    <>{shortDate(c.oldDate)}の予定が一覧から外れました</>
                  )}
                  {c.sourceUrl && (
                    <a href={c.sourceUrl} target="_blank" rel="noopener" className="ml-2 text-xs font-bold text-accent hover:underline">
                      情報源 ↗
                    </a>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="card p-5" aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-lg font-black">
            終わった予定と、その後のニュース
          </h2>
          <p className="mt-1 text-xs text-fg-subtle">直近{PAST_DAYS}日に発売・放送・公開・変更された予定です。作品や話題のページで、その後のニュースを見られます。</p>
          <ul className="mt-2 divide-y divide-border text-sm">
            {past.map((it, i) => (
              <li key={i} className="flex items-baseline gap-3 py-2">
                <span className="w-10 shrink-0 text-xs text-fg-subtle tabular-nums">{shortDate(it.date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="mr-1.5 text-xs text-fg-muted">{CALENDAR_LABELS[it.category]}</span>
                  <Link href={it.href!} prefetch={false} className="font-bold hover:text-accent">
                    {it.title}
                  </Link>
                </span>
                <Link href={it.href!} prefetch={false} className="shrink-0 text-xs font-bold text-accent hover:underline">
                  その後のニュース →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="text-xs leading-relaxed text-fg-subtle">
        <p>
          日付は、ニュースで報じられた内容・任天堂/PlayStation/Steam の公式ストア・Wikipedia（映画・テレビアニメの一覧、CC BY-SA）をもとに自動でまとめています。
          予定は変わることがあるため、最新の情報は各社の発表でご確認ください。
        </p>
        <p className="mt-1">
          最終確認：
          {(["game", "movie", "anime"] as const)
            .map((k) => `${SCHEDULE_KIND_LABELS[k]} ${checked[k] ? formatDateTime(checked[k]!) : "—"}`)
            .join("／")}
          （新商品・暮らしの変更は、報じられた時点の内容です）
        </p>
      </div>
    </div>
  );
}
