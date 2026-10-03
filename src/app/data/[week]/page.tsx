import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { elapsedLabel } from "@/lib/coverage";
import { getWeekReport, type ReportTopic } from "@/lib/report";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { isWeeklyKey, recentWeeks, weekKey, weekLabel } from "@/lib/weekly";

export const revalidate = 1800;

const fmt = (n: number) => n.toLocaleString("ja-JP");

export async function generateMetadata({ params }: PageProps<"/data/[week]">): Promise<Metadata> {
  const { week } = await params;
  if (!isWeeklyKey(week)) return {};
  const title = `今週の報道データ（${weekLabel(week)}）`;
  const description = `${weekLabel(week)}の1週間に、どの出来事を何社が報じたか、どの媒体が最初に報じたか、どれだけ速く報道が広がったかを、ぜんぶナビが集めた記録から数えた週次レポートです。`;
  return {
    title,
    description,
    alternates: { canonical: `/data/${week}` },
    openGraph: { title, description, type: "article", siteName: siteConfig.name, locale: "ja_JP" },
  };
}

function TopicRow({ t, rank, note }: { t: ReportTopic; rank: number; note: string }) {
  return (
    <li className="flex gap-3 py-2">
      <span className="w-6 shrink-0 text-right font-black tabular-nums text-fg-subtle">{rank}</span>
      <div className="min-w-0">
        <Link href={`/topic/${t.id}`} className="font-bold leading-snug hover:text-accent">
          {t.title}
        </Link>
        <p className="mt-0.5 text-xs text-fg-muted">
          {t.genre}・{note}
        </p>
      </div>
    </li>
  );
}

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix: string }) {
  return (
    <li className="grid grid-cols-[7.5em_1fr_auto] items-center gap-2 py-1 text-sm">
      <span className="truncate">{label}</span>
      <span className="h-2.5 rounded-full bg-surface-muted">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, (value / max) * 100)}%` }} />
      </span>
      <span className="tabular-nums text-fg-muted">
        {fmt(value)}
        {suffix}
      </span>
    </li>
  );
}

export default async function WeekReportPage({ params }: PageProps<"/data/[week]">) {
  const { week } = await params;
  if (!isWeeklyKey(week)) notFound();
  const data = await getWeekReport(week);
  if (!data) notFound();
  const label = weekLabel(week);
  const current = week === weekKey();
  const weeks = recentWeeks(8);

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "今週の報道データ", path: `/data/${week}` },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: `今週の報道データ（${label}）`,
              description: "1週間に報じられた出来事ごとの、報じた媒体の数・最初の報道・報道の広がり（転載を除く）",
              creator: { "@type": "Organization", name: siteConfig.operator },
              url: `${siteConfig.url}/data/${week}`,
            },
          ]),
        }}
      />
      <header className="card p-5 sm:p-6">
        <p className="text-xs font-bold text-accent">週次レポート</p>
        <h1 className="mt-1 text-2xl leading-snug font-black">
          今週の報道データ
          <span className="mt-1 block text-base font-bold text-fg-muted">
            {label}
            {current && "（途中経過・毎時更新）"}
          </span>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          ぜんぶナビは各媒体の配信を数分おきに集め、同じ出来事の記事を1つにまとめています。その記録から、この1週間に「どの出来事を何社が報じたか」「どの媒体が最初に報じたか」「報道がどれだけ速く広がったか」を数えました。媒体の数は、転載・再配信を除いた独立した報道の数です。
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["集めた記事", `${fmt(data.articles)}件`],
            ["報じた媒体", `${fmt(data.outlets)}媒体`],
            ["2社以上が報じた出来事", `${fmt(data.topics2)}件`],
            ["3社以上が報じた出来事", `${fmt(data.topics3)}件`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-muted p-3">
              <dt className="text-xs text-fg-muted">{k}</dt>
              <dd className="mt-0.5 text-lg font-black tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section className="card p-5" aria-labelledby="top">
        <h2 id="top" className="text-lg font-black">
          報道の多かった出来事
        </h2>
        <p className="mt-1 text-sm text-fg-muted">報じた媒体の数の多い順。カッコ内は最初の報道から1時間以内に報じた媒体の数です。</p>
        <ol className="mt-2 divide-y divide-border">
          {data.top.map((t, i) => (
            <TopicRow key={t.id} t={t} rank={i + 1} note={`${t.publishers}社が報道（1時間以内に${t.within1h}社）${t.first ? `・最初は${t.first}` : ""}`} />
          ))}
        </ol>
      </section>

      {data.fastest.length > 0 && (
        <section className="card p-5" aria-labelledby="fast">
          <h2 id="fast" className="text-lg font-black">
            報道が速く広がった出来事
          </h2>
          <p className="mt-1 text-sm text-fg-muted">最初の報道から、5社目が報じるまでの時間が短い順。</p>
          <ol className="mt-2 divide-y divide-border">
            {data.fastest.map((t, i) => (
              <TopicRow key={t.id} t={t} rank={i + 1} note={`5社目まで${t.to5 === 0 ? "同時" : elapsedLabel(t.to5!).replace("+", "")}・最終的に${t.publishers}社`} />
            ))}
          </ol>
        </section>
      )}

      {data.firsts.length > 0 && (
        <section className="card p-5" aria-labelledby="first">
          <h2 id="first" className="text-lg font-black">
            最初に報じた回数の多い媒体
          </h2>
          <p className="mt-1 text-sm text-fg-muted">3社以上が報じた出来事 {fmt(data.firstsTotal)}件のうち、ぜんぶナビが最初に配信を確認した媒体の回数です（転載を配信するサービスは除く）。</p>
          <ul className="mt-2">
            {data.firsts.map((f) => (
              <Bar key={f.publisher} label={f.publisher} value={f.count} max={data.firsts[0].count} suffix="回" />
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5" aria-labelledby="genre">
        <h2 id="genre" className="text-lg font-black">
          ジャンル別の報道量
        </h2>
        <p className="mt-1 text-sm text-fg-muted">2社以上が報じた出来事について、報じた媒体の数を足し合わせたものです（出来事の数はカッコ内）。</p>
        <ul className="mt-2">
          {data.genres.map((g) => (
            <Bar key={g.slug} label={`${g.name}（${g.topics}）`} value={g.reports} max={data.genres[0].reports} suffix="件" />
          ))}
        </ul>
      </section>

      {data.splits.length > 0 && (
        <section className="card p-5" aria-labelledby="split">
          <h2 id="split" className="text-lg font-black">
            見出しの数字が媒体で分かれたニュース
          </h2>
          <p className="mt-1 text-sm text-fg-muted">報じた時点や数え方の違いによることがあります。最新の情報は各社の記事でご確認ください。</p>
          <ul className="mt-2 divide-y divide-border">
            {data.splits.map((s) => (
              <li key={s.id} className="py-2">
                <Link href={`/topic/${s.id}`} className="font-bold leading-snug hover:text-accent">
                  {s.title}
                </Link>
                {s.diffs.map((d) => (
                  <p key={d.label} className="mt-0.5 text-xs text-fg-muted">
                    {d.values.map((v) => `${v.value}（${v.publishers.join("・")}）`).join(" ／ ")}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5 text-sm leading-relaxed text-fg-muted">
        <h2 className="mb-1 font-bold text-fg">データの作り方</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>対象は、この週（月曜0時〜日曜24時、日本時間）に最初に報じられ、2社以上が報じた出来事です。</li>
          <li>媒体の数は、転載・再配信（ポータルへの配信や、同じ見出しの記事）を1つに数えた、独立した報道の数です。</li>
          <li>報道の時刻は、ぜんぶナビが各媒体の配信を確認した時刻です。各社の実際の公開時刻とは数分ずれることがあります。</li>
          <li>
            報道の内容の評価（偏りや正確さ）はしていません。詳しくは
            <Link href="/about" className="text-accent underline">
              運営方針
            </Link>
            をご覧ください。
          </li>
        </ul>
      </section>

      <nav aria-label="ほかの週" className="card flex flex-wrap gap-2 p-4 text-sm">
        {weeks.map((w) => (
          <Link key={w} href={`/data/${w}`} aria-current={w === week ? "page" : undefined} className={`rounded-full border px-3 py-1 ${w === week ? "border-accent font-bold text-accent" : "border-border"}`}>
            {weekLabel(w)}
          </Link>
        ))}
        <Link href={`/weekly/${week}`} className="rounded-full border border-border px-3 py-1">
          この週の10大ニュース →
        </Link>
      </nav>
    </article>
  );
}
