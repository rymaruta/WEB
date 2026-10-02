import type { Metadata } from "next";
import Link from "next/link";
import { firstReporter, numberDiffs, withinDays, type CoverageArticle } from "@/lib/coverage";
import { publisherLabel } from "@/lib/publisher";
import { getCoverageTopics } from "@/lib/queries";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "報道くらべ｜最初に報じた媒体のランキングと、数字が分かれたニュース",
  description:
    "同じ出来事を各社がいつ・どんな数字で報じたかを比べます。この1週間に最初に報じた回数の多い媒体のランキングと、見出しの数字が媒体によって分かれたニュースの一覧です。",
  alternates: { canonical: "/compare" },
};

const RANK_DAYS = 7;
const DIFF_DAYS = 3;

export default async function ComparePage() {
  const topics = await getCoverageTopics(RANK_DAYS);
  const toCoverage = (t: (typeof topics)[number]): CoverageArticle[] =>
    t.articles.map((a) => ({ id: a.id, publisher: a.publisher, publishedAt: a.publishedAt, title: a.title, kind: a.source.kind }));

  // 速報ランキング：3媒体以上が報じた出来事で、最初に報じた回数
  const firstCounts = new Map<string, number>();
  for (const t of topics) {
    const p = firstReporter(toCoverage(t));
    if (p) firstCounts.set(publisherLabel(p), (firstCounts.get(publisherLabel(p)) ?? 0) + 1);
  }
  const ranking = [...firstCounts].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const total = [...firstCounts.values()].reduce((a, b) => a + b, 0);

  // 数字が分かれたニュース（直近）
  const split = topics
    .filter((t) => withinDays(t.firstSeenAt, DIFF_DAYS))
    .map((t) => ({ t, diffs: numberDiffs(toCoverage(t), publisherLabel) }))
    .filter((x) => x.diffs.length > 0)
    .slice(0, 30);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="card p-5 sm:p-6">
        <h1 className="text-2xl font-black">報道くらべ</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          多くの媒体のニュースを同時に集めているので、同じ出来事を各社が「いつ」「どんな数字で」報じたかを比べられます。各ニュースのページでも、媒体ごとに最初の報道から何分後だったかを表示しています。
        </p>
      </header>

      <section className="card p-5" aria-labelledby="speed">
        <h2 id="speed" className="text-lg font-black">
          速報ランキング<span className="ml-2 text-xs font-normal text-fg-subtle">この{RANK_DAYS}日間・3媒体以上が報じた{total}件の出来事</span>
        </h2>
        <p className="mt-1 text-xs text-fg-subtle">その出来事を、このサイトが集めている媒体の中で最初に報じた回数です（企業の発表・SNS・ほかの媒体の記事を転載して配信するサービスは除く）。</p>
        {ranking.length === 0 ? (
          <p className="mt-3 text-sm text-fg-subtle">まだ集計できる出来事がありません。</p>
        ) : (
          <ol className="mt-3 space-y-1.5">
            {ranking.map(([name, n], i) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <span className="w-6 shrink-0 text-right font-black tabular-nums text-fg-muted">{i + 1}</span>
                <span className="w-40 shrink-0 truncate font-bold">{name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / ranking[0][1]) * 100}%` }} />
                </span>
                <span className="w-10 shrink-0 text-right tabular-nums">{n}回</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card p-5" aria-labelledby="split">
        <h2 id="split" className="text-lg font-black">
          数字が分かれたニュース<span className="ml-2 text-xs font-normal text-fg-subtle">直近{DIFF_DAYS}日間</span>
        </h2>
        <p className="mt-1 text-xs text-fg-subtle">同じ出来事で、見出しの数字が媒体によって違うものです。報じた時点や数え方の違いによることがあります。</p>
        {split.length === 0 ? (
          <p className="mt-3 text-sm text-fg-subtle">いまは見つかっていません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {split.map(({ t, diffs }) => (
              <li key={t.id} className="py-3">
                <Link href={`/topic/${t.id}`} prefetch={false} className="font-bold leading-snug hover:text-accent">
                  {t.aiTitle ?? t.title}
                </Link>
                <ul className="mt-1 space-y-0.5 text-[13px] text-fg-muted">
                  {diffs.map((d) => (
                    <li key={d.label}>{d.values.map((v) => `${v.value}（${v.publishers.join("・")}）`).join(" ／ ")}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
