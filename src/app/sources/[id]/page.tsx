import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdsenseScript } from "@/components/adsense-script";
import { siteConfig } from "@/config/site";
import { elapsedLabel } from "@/lib/coverage";
import { formatDateTime } from "@/lib/format";
import { isGovernment, pressLabel } from "@/lib/government";
import { getOutletProfile, isIndexableOutlet, type OutletProfile } from "@/lib/outlet";
import { publisherLabel } from "@/lib/publisher";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const revalidate = 3600;

const fmt = (n: number) => n.toLocaleString("ja-JP");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
/** 経過の表示（同時・5分・2時間・1日） */
const span = (m: number) => (m <= 0 ? "同時" : elapsedLabel(m).replace("+", ""));

const kindName = (p: Pick<OutletProfile, "kind" | "publisher">) => (p.kind === "NEWS" ? "報道" : pressLabel(p.publisher));

async function load(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) return null;
  return getOutletProfile(Number(id));
}

export async function generateMetadata({ params }: PageProps<"/sources/[id]">): Promise<Metadata> {
  const p = await load(params);
  if (!p) return {};
  const name = publisherLabel(p.publisher);
  const title = p.kind === "NEWS" ? `${name}の報道データ` : `${name}の発表と報道`;
  const description =
    p.kind === "NEWS"
      ? `${name}が直近${p.days}日に報じた記事の数・時間帯・ジャンルと、ほかの媒体と同じ出来事を報じたときに何番目・何分後に報じたかを、ぜんぶナビが集めた記録から数えたデータです。`
      : `${name}が直近${p.days}日に出した発表のうち、報道機関が報じたものの割合と、発表から報道までの時間を、ぜんぶナビが集めた記録から数えたデータです。`;
  return {
    title,
    description,
    alternates: { canonical: `/sources/${p.id}` },
    robots: isIndexableOutlet(p) ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "article", siteName: siteConfig.name, locale: "ja_JP" },
  };
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-black tabular-nums">{value}</dd>
      {note && <dd className="text-[11px] text-fg-subtle">{note}</dd>}
    </div>
  );
}

/** 縦棒のグラフ。読み上げ用に要約を添える */
function Bars({ values, labels, summary, every }: { values: number[]; labels: string[]; summary: string; every: number }) {
  const max = Math.max(1, ...values);
  return (
    <figure className="mt-3">
      <div className="flex h-28 items-end gap-px" role="img" aria-label={summary}>
        {values.map((v, i) => (
          <span key={i} className="flex-1 rounded-t-sm bg-accent/80" style={{ height: `${v === 0 ? 0 : Math.max(3, (v / max) * 100)}%` }} title={`${labels[i]}: ${v}件`} />
        ))}
      </div>
      <div className="mt-1 flex gap-px text-[10px] text-fg-subtle" aria-hidden>
        {labels.map((l, i) => (
          <span key={i} className="flex-1 overflow-visible whitespace-nowrap">
            {i % every === 0 ? l : ""}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-fg-muted">{summary}</figcaption>
    </figure>
  );
}

function Volume({ p }: { p: OutletProfile }) {
  const { daily, hourly, genres } = p.volume;
  const busiest = hourly.indexOf(Math.max(...hourly));
  const avg = Math.round((p.total / p.days) * 10) / 10;
  return (
    <section className="card p-5" aria-labelledby="volume">
      <h2 id="volume" className="text-lg font-black">
        {p.kind === "NEWS" ? "いつ・何を報じているか" : "いつ・何を発表しているか"}
      </h2>
      <h3 className="mt-3 text-sm font-bold">日ごとの本数（直近{p.days}日）</h3>
      <Bars
        values={daily.map((d) => d.count)}
        labels={daily.map((d) => `${Number(d.day.slice(5, 7))}/${Number(d.day.slice(8))}`)}
        every={7}
        summary={`直近${p.days}日で${fmt(p.total)}件、1日平均${avg}件`}
      />
      <h3 className="mt-5 text-sm font-bold">時間帯ごとの本数（日本時間）</h3>
      <Bars values={hourly} labels={hourly.map((_, h) => `${h}時`)} every={3} summary={`いちばん多いのは${busiest}時台（${fmt(hourly[busiest])}件）`} />
      {genres.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-bold">ジャンル</h3>
          <ul className="mt-2 space-y-1">
            {genres.slice(0, 6).map((g) => (
              <li key={g.name} className="grid grid-cols-[7em_1fr_auto] items-center gap-2 text-sm">
                <span className="truncate">{g.name}</span>
                <span className="h-2.5 rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(4, pct(g.count, genres[0].count))}%` }} />
                </span>
                <span className="tabular-nums text-fg-muted">{pct(g.count, p.total)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Race({ p }: { p: OutletProfile }) {
  const r = p.race;
  const name = publisherLabel(p.publisher);
  if (!r) {
    return (
      <section className="card p-5 text-sm text-fg-muted">
        {name}はほかの媒体の記事を転載して配信する媒体のため、報じた速さは比べていません。
      </section>
    );
  }
  if (r.compared === 0) {
    return <section className="card p-5 text-sm text-fg-muted">直近{p.days}日に、{name}がほかの2社以上と同じ出来事を報じた記録はまだありません。</section>;
  }
  return (
    <section className="card p-5" aria-labelledby="race">
      <h2 id="race" className="text-lg font-black">
        同じ出来事を報じたときの速さ
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        独立した報道が3社以上あった出来事で、{name}が何番目に、最初の報道から何分後に報じたか。転載・再配信は除いています。
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="比べた出来事" value={`${fmt(r.compared)}件`} />
        <Stat label="最初に報じた" value={`${fmt(r.firsts)}件`} note={`${pct(r.firsts, r.compared)}%`} />
        <Stat label="1時間以内に報じた" value={`${fmt(r.within1h)}件`} note={`${pct(r.within1h, r.compared)}%`} />
        <Stat label="最初の報道からの遅れ" value={r.medianBehind === null ? "—" : span(r.medianBehind)} note="2番目以降に報じたときの中央値" />
      </dl>
      <h3 className="mt-5 text-sm font-bold">報じた媒体の多かった出来事</h3>
      <ol className="mt-1 divide-y divide-border">
        {r.major.map((t) => (
          <li key={t.id} className="py-2">
            <Link href={`/topic/${t.id}`} className="font-bold leading-snug hover:text-accent">
              {t.title}
            </Link>
            <p className="mt-0.5 text-xs text-fg-muted">
              {t.publishers}社中{t.rank}番目{t.rank === 1 ? "（最初の報道）" : `・最初の報道から${span(t.minutes)}`}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Announcements({ p }: { p: OutletProfile }) {
  const a = p.announcements;
  if (!a) return null;
  const name = publisherLabel(p.publisher);
  return (
    <section className="card p-5" aria-labelledby="press">
      <h2 id="press" className="text-lg font-black">
        発表は報じられたか
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {name}の発表と同じ出来事を報じた報道機関の記事を数えました（転載・再配信を除く）。報道までの時間は、時刻つきで配信された発表だけで測っています。
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="発表" value={`${fmt(a.total)}件`} />
        <Stat label="報道された発表" value={`${fmt(a.reported)}件`} note={`${pct(a.reported, a.total)}%`} />
        <Stat label="発表から報道まで" value={a.medianLag === null ? "—" : span(a.medianLag)} note="中央値" />
        <Stat label="発表より先に報道" value={`${fmt(a.before)}件`} note="事前に報じられていた発表" />
      </dl>
      {a.top.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-bold">報じた媒体の多かった発表</h3>
          <ol className="mt-1 divide-y divide-border">
            {a.top.map((r) => (
              <li key={r.id} className="py-2">
                <Link href={`/topic/${r.topicId}`} className="font-bold leading-snug hover:text-accent">
                  {r.title}
                </Link>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {r.reporters}社が報道
                  {r.before ? "・発表より先に報道あり" : r.lag !== null ? `・発表から${span(r.lag)}で最初の報道` : ""}
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
      <h3 className="mt-5 text-sm font-bold">最近の発表</h3>
      <ul className="mt-1 divide-y divide-border">
        {a.recent.map((r) => (
          <li key={r.id} className="py-2 text-sm">
            <a href={r.url} target="_blank" rel="noopener" className="leading-snug hover:text-accent hover:underline">
              {r.title}
            </a>
            <p className="mt-0.5 text-xs text-fg-muted">
              {formatDateTime(r.publishedAt)}・{r.reporters > 0 ? `${r.reporters}社が報道` : "報道なし"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function OutletPage({ params }: PageProps<"/sources/[id]">) {
  const p = await load(params);
  if (!p) notFound();
  const name = publisherLabel(p.publisher);
  const heading = p.kind === "NEWS" ? `${name}の報道データ` : `${name}の発表と報道`;
  const label = p.kind === "PRESS" && isGovernment(p.publisher) ? "官公庁の発表" : kindName(p);

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      {isIndexableOutlet(p) && <AdsenseScript />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "掲載メディア一覧", path: "/sources" },
              { name: heading, path: `/sources/${p.id}` },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Dataset",
              name: heading,
              description: `${name}の直近${p.days}日の記事・発表を、ぜんぶナビが集めた記録から数えたデータ`,
              creator: { "@type": "Organization", name: siteConfig.operator },
              url: `${siteConfig.url}/sources/${p.id}`,
            },
          ]),
        }}
      />
      <header className="card p-5 sm:p-6">
        <p className="text-xs font-bold text-accent">媒体のデータ・{label}</p>
        <h1 className="mt-1 text-2xl leading-snug font-black">{heading}</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          ぜんぶナビは各媒体の配信を数分おきに集め、同じ出来事の記事を1つにまとめています。その記録から、{name}の直近{p.days}日の
          {p.kind === "NEWS" ? "報道を数えました。" : "発表と、それを報じた報道を数えました。"}
          AI による推測は含まず、記録を数えただけの値です。
        </p>
        <p className="mt-3 text-xs text-fg-subtle">
          配信元:{" "}
          {p.feeds.map((f, i) => (
            <span key={f.name}>
              {i > 0 && "、"}
              <a href={f.siteUrl} target="_blank" rel="noopener" className="hover:text-accent hover:underline">
                {f.name}
              </a>
            </span>
          ))}
        </p>
      </header>
      <Volume p={p} />
      {p.kind === "NEWS" ? <Race p={p} /> : <Announcements p={p} />}
      <p className="text-center text-sm">
        <Link href="/sources" className="text-accent hover:underline">
          ほかの媒体のデータを見る
        </Link>
        {" ・ "}
        <Link href="/data" className="text-accent hover:underline">
          今週の報道データ
        </Link>
      </p>
    </article>
  );
}
