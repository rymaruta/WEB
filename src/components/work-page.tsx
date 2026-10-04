import { AdsenseScript } from "@/components/adsense-script";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { jstDate } from "@/lib/calendar";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { daysUntil, isPast, longDate, readWorkParam } from "@/lib/work-keys";
import { getAnimeWork, getGameWork, getMovieWork, workPath, type Work, type WorkKind } from "@/lib/works";
import { TopicList } from "./topic-card";

const LOAD: Record<WorkKind, (key: string) => Promise<Work | null>> = { game: getGameWork, anime: getAnimeWork, movie: getMovieWork };
const GENRE: Record<WorkKind, { slug: string; name: string }> = {
  game: { slug: "game", name: "ゲーム" },
  anime: { slug: "anime", name: "アニメ・漫画" },
  movie: { slug: "entertainment", name: "エンタメ" },
};

/** アニメの種類ごとの言い方 */
const ANIME_VERB: Record<string, { start: string; label: string }> = {
  tv: { start: "放送開始", label: "放送開始日" },
  stream: { start: "配信開始", label: "配信開始日" },
  movie: { start: "公開", label: "公開日" },
};

function words(w: Work) {
  if (w.kind === "game") return { start: "発売", label: "発売日", where: "機種" };
  if (w.kind === "movie") return { start: "公開", label: "公開日", where: "製作国" };
  const v = ANIME_VERB[w.animeKind ?? ""] ?? { start: "放送開始", label: "放送開始日" };
  return { ...v, where: "放送・配信" };
}

/** 「いつ？」への答え（ニュースと公式の一覧に書かれた日付だけを使う） */
export function answer(w: Work, today: string): string {
  const { start } = words(w);
  if (!w.date) return `${w.title}の${start}日は、まだ発表されていません。決まりしだい、このページでお知らせします。`;
  // 映画の国は製作国で、公開する場所ではないため、文には入れない
  const where = w.kind !== "movie" && w.platforms.length ? `${w.platforms.slice(0, 4).join("・")}で` : "";
  if (isPast(w.date, today)) return `${w.title}は${longDate(w.date)}に${where}${start}されました。`;
  const d = daysUntil(w.date, today);
  const left = d === null ? "" : d === 0 ? "きょうが当日です。" : `${start}まであと${d}日です。`;
  return `${w.title}は${longDate(w.date)}に${where}${start}予定です。${left}`;
}

export async function workMetadata(kind: WorkKind, raw: string): Promise<Metadata> {
  const w = await LOAD[kind](readWorkParam(raw));
  if (!w) return {};
  const { label } = words(w);
  const title =
    kind === "game" ? `${w.title}の発売日はいつ？対応機種と最新情報` : kind === "movie" ? `映画「${w.title}」の公開日はいつ？最新情報` : `${w.title}はいつから？${label}と最新情報`;
  return {
    title,
    description: `${answer(w, jstDate())}${w.title}に関する最新ニュースを、複数の媒体の報道からまとめています。`.slice(0, 160),
    alternates: { canonical: workPath(kind, w.key) },
    robots: w.indexable ? undefined : { index: false, follow: true },
  };
}

/** 作品ページ（ゲーム・アニメ）。発売日・放送日と、これまでのニュースを1ページに */
export async function WorkPage({ kind, raw }: { kind: WorkKind; raw: string }) {
  const w = await LOAD[kind](readWorkParam(raw));
  if (!w) notFound();
  const today = jstDate();
  const { start, label, where } = words(w);
  const days = w.date ? daysUntil(w.date, today) : null;
  const genre = GENRE[kind];
  const url = `${siteConfig.url}${workPath(kind, w.key)}`;
  const jsonLd =
    kind === "game"
      ? { "@context": "https://schema.org", "@type": "VideoGame", name: w.title, url, ...(w.platforms.length ? { gamePlatform: w.platforms } : {}) }
      : kind === "movie"
        ? { "@context": "https://schema.org", "@type": "Movie", name: w.title, url, ...(w.platforms.length ? { countryOfOrigin: w.platforms[0] } : {}) }
        : { "@context": "https://schema.org", "@type": "TVSeries", name: w.title, url, ...(w.date && w.date.length === 10 ? { startDate: w.date } : {}) };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* 広告は、検索エンジンに登録する（内容のある）作品のページだけ */}
      {w.indexable && <AdsenseScript />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            jsonLd,
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: `${genre.name}ニュース`, path: `/genre/${genre.slug}` },
              { name: w.title, path: workPath(kind, w.key) },
            ]),
          ]),
        }}
      />
      <header className="card p-5 sm:p-6">
        <nav aria-label="パンくず" className="mb-2 text-xs text-fg-subtle">
          <Link href={`/genre/${genre.slug}`} className="hover:text-fg">
            {genre.name}
          </Link>
          <span className="mx-1">›</span>
          <span>作品</span>
        </nav>
        <h1 className="text-2xl leading-snug font-black">{w.title}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-surface-muted p-3">
            <dt className="text-[11px] text-fg-subtle">{label}</dt>
            <dd className="mt-0.5 text-base font-black">{w.date ? longDate(w.date) : "未発表"}</dd>
            {days !== null && <dd className="mt-1 inline-block rounded-full bg-accent-soft px-2 text-xs font-bold text-accent">{days === 0 ? "きょう" : `あと${days}日`}</dd>}
          </div>
          <div className="rounded-lg bg-surface-muted p-3">
            <dt className="text-[11px] text-fg-subtle">{where}</dt>
            <dd className="mt-0.5 text-sm font-bold">{w.platforms.length ? w.platforms.join("・") : "—"}</dd>
          </div>
        </dl>
        <section aria-labelledby="work-when" className="mt-4">
          <h2 id="work-when" className="text-sm font-bold text-fg-muted">
            {w.title}の{start}日はいつ？
          </h2>
          <p className="mt-1 leading-relaxed">{answer(w, today)}</p>
        </section>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {w.storeUrl && (
            <a href={w.storeUrl} target="_blank" rel="noopener nofollow" className="rounded-full border border-border px-3 py-1 font-bold hover:border-accent hover:text-accent">
              公式ストアで見る ↗
            </a>
          )}
          <Link href="/calendar" prefetch={false} className="rounded-full border border-border px-3 py-1 font-bold hover:border-accent hover:text-accent">
            ぜんぶカレンダー
          </Link>
          <Link href={`/search?${new URLSearchParams({ q: w.title })}`} prefetch={false} className="rounded-full border border-border px-3 py-1 font-bold hover:border-accent hover:text-accent">
            「{w.title}」で検索
          </Link>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
          日付は、
          {kind === "game"
            ? "ニュースで報じられた内容と公式ストア"
            : kind === "movie"
              ? "日本で公開される映画の一覧（Wikipedia、CC BY-SA）"
              : "ニュースで報じられた内容とテレビアニメの放送予定の一覧（Wikipedia）"}
          をもとに自動でまとめています。変更されることがあるため、最新の情報は公式の発表でご確認ください。
        </p>
      </header>
      <section aria-labelledby="work-news" className="card px-4 sm:px-5">
        <h2 id="work-news" className="pt-4 text-lg font-black">
          {w.title}のニュース<span className="ml-2 text-sm font-bold text-fg-subtle">{w.topics.length}件（新しい順）</span>
        </h2>
        <TopicList topics={w.topics} showGenre={false} />
      </section>
    </div>
  );
}
