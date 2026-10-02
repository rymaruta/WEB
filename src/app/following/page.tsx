import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TopicCard } from "@/components/topic-card";
import { getCalendar } from "@/lib/calendar";
import { CALENDAR_COLORS, CALENDAR_LABELS } from "@/lib/calendar-kinds";
import { companyPath } from "@/lib/company";
import { parseFollowParams } from "@/lib/follow-kinds";
import { getCompanyTopics, getTagTopics, searchTopics, type TopicCardData } from "@/lib/queries";
import { findTag, matchesTag, tagPath } from "@/lib/tags";
import { FollowingSync, FollowManager } from "./following-client";

export const metadata: Metadata = {
  title: "フォロー中",
  description: "フォローした企業・チーム・国・キーワードのニュースと、これからの予定をまとめて見られます。",
  robots: { index: false, follow: true },
};

/** 1つのフォローから集める話題の数と、並べる数 */
const PER_FOLLOW = 6;
const FEED_MAX = 40;

const fold = (s: string) => s.normalize("NFKC").toLowerCase();

export default async function FollowingPage({ searchParams }: PageProps<"/following">) {
  const follows = parseFollowParams((await searchParams).f);

  // フォローごとに、名前・ページ・話題・予定の見分け方を決める
  const resolved = await Promise.all(
    follows.map(async (f) => {
      if (f.kind === "team" || f.kind === "country") {
        const tag = findTag(f.kind, f.key);
        if (!tag) return null;
        const { items } = await getTagTopics(tag, 0, PER_FOLLOW);
        return { label: tag.name, href: tagPath(tag), items, match: (text: string) => matchesTag(tag, text) };
      }
      const { items } = f.kind === "company" ? await getCompanyTopics(f.key, 0, PER_FOLLOW) : await searchTopics(f.key, 0, PER_FOLLOW);
      const href = f.kind === "company" ? companyPath(f.key) : `/search?${new URLSearchParams({ q: f.key })}`;
      return { label: f.key, href, items, match: (text: string) => fold(text).includes(fold(f.key)) };
    }),
  );
  const sources = resolved.filter((r) => r !== null);

  // 話題を1つの流れにまとめる（同じ話題は1回だけ、どのフォローに当たったかを添える）
  const feed = new Map<number, { topic: TopicCardData; labels: string[] }>();
  for (const s of sources) {
    for (const t of s.items) {
      const e = feed.get(t.id);
      if (e) e.labels.push(s.label);
      else feed.set(t.id, { topic: t, labels: [s.label] });
    }
  }
  const items = [...feed.values()].sort((a, b) => b.topic.lastSeenAt.getTime() - a.topic.lastSeenAt.getTime()).slice(0, FEED_MAX);

  // これからの予定（ぜんぶカレンダーから、フォローに当たるもの）
  const calendar = sources.length ? (await getCalendar()).items.filter((it) => sources.some((s) => s.match(`${it.title} ${it.note ?? ""}`))).slice(0, 30) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Suspense>
        <FollowingSync />
      </Suspense>
      <header className="card space-y-3 p-5 sm:p-6">
        <h1 className="text-2xl font-black">フォロー中</h1>
        <p className="text-sm leading-relaxed text-fg-muted">
          企業・チーム・国・キーワードをフォローすると、ジャンルをまたいで、そのニュースと予定がこのページにまとまります。企業やチームのページの「＋ フォロー」から追加できます。フォローはこの端末にだけ保存されます（登録は不要です）。
        </p>
        <FollowManager />
      </header>

      {sources.length === 0 ? (
        <section className="card p-5 text-sm text-fg-muted">
          <p className="font-bold text-fg">まだ何もフォローしていません</p>
          <p className="mt-1">
            たとえば{" "}
            <Link href="/company" className="text-accent hover:underline">
              企業別ニュース
            </Link>{" "}
            や、スポーツのページのチームから選んでフォローできます。上の欄に、作品名や商品名などのキーワードを入れても追加できます。
          </p>
        </section>
      ) : (
        <>
          {calendar.length > 0 && (
            <section className="card p-4 sm:p-5" aria-labelledby="following-calendar">
              <h2 id="following-calendar" className="text-lg font-black">
                これからの予定
              </h2>
              <ul className="mt-2 divide-y divide-border">
                {calendar.map((it, i) => {
                  const [, m, d] = it.date.split("-").map(Number);
                  const row = (
                    <>
                      <span className="w-12 shrink-0 text-xs font-bold tabular-nums">{`${m}/${d}`}</span>
                      <span className="shrink-0 rounded px-1 text-[10px] leading-4 font-bold text-white" style={{ backgroundColor: CALENDAR_COLORS[it.category] }}>
                        {CALENDAR_LABELS[it.category]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-bold group-hover:text-accent">{it.title}</span>
                    </>
                  );
                  return (
                    <li key={`${it.category}-${it.title}-${i}`}>
                      {it.href && !it.external ? (
                        <Link href={it.href} prefetch={false} className="group flex items-center gap-2 py-2">
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2 py-2">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <section className="card px-4 sm:px-5" aria-labelledby="following-news">
            <h2 id="following-news" className="pt-4 text-lg font-black">
              新着ニュース
            </h2>
            {items.length === 0 ? (
              <p className="py-6 text-sm text-fg-subtle">フォローしているもののニュースは、まだありません。</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map(({ topic, labels }) => (
                  <li key={topic.id} className="pt-2">
                    <p className="text-[11px] font-bold text-accent">{labels.join("・")}</p>
                    <TopicCard topic={topic} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <nav aria-label="フォローしているページ" className="flex flex-wrap gap-2 text-xs">
            {sources.map((s) => (
              <Link key={s.href} href={s.href} prefetch={false} className="rounded-full border border-border px-3 py-1 hover:border-accent hover:text-accent">
                {s.label}のニュースをもっと見る
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
