import type { Metadata } from "next";
import { cleanTitle } from "@/lib/feed/text";
import { publisherLabel } from "@/lib/publisher";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { coverageTimes, elapsedLabel, numberDiffs } from "@/lib/coverage";
import { isIndexableArticle } from "@/lib/indexing";
import { featurePath, featureShortName, isFeatureMonth, type FeatureKind } from "@/lib/features";
import { AiArticleView } from "@/components/ai-article";
import { EventTimeline } from "@/components/event-timeline";
import { TopicBrief } from "@/components/topic-brief";
import { GroupTabs } from "@/components/group-tabs";
import { ReadingProgress } from "@/components/scroll-helpers";
import { FeedbackButtons } from "@/components/feedback-buttons";
import { GenreBadge } from "@/components/genre-badge";
import { GenreIcon } from "@/components/genre-icon";
import { OutboundLink } from "@/components/outbound-link";
import { PublisherAvatars } from "@/components/publisher-avatars";
import { Thumbnail } from "@/components/thumbnail";
import { SectionHeading } from "@/components/section-heading";
import { SaveButton } from "@/components/save-button";
import { ShareButtons } from "@/components/share-buttons";
import { siteConfig } from "@/config/site";
import { MarketEventBadge, RumorBadge, TopicList } from "@/components/topic-card";
import { readAiArticle } from "@/lib/ai/article";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { getTopic, getTrendingTopics } from "@/lib/queries";
import { getEventTimeline } from "@/lib/topics/timeline";
import { buildBrief, getTopicWhy } from "@/lib/topics/brief";
import { breadcrumbJsonLd, newsArticleJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { kindTone } from "@/components/kind-badge";
import { workKey, workPath } from "@/lib/work-keys";
import { getRelatedNews } from "@/lib/topics/related-news";
import { jstDay } from "@/lib/archive";
import { displayExcerpt, displayImage } from "@/lib/rights";
import { readPhoto } from "@/lib/photo-data";
import { stockPhoto } from "@/lib/stock-photos";

export const revalidate = 60;

/** ビルド時には生成せず、初回アクセス時に生成して ISR でキャッシュする */
export async function generateStaticParams() {
  return [];
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id < 2 ** 31 ? id : null;
}

export async function generateMetadata({ params }: PageProps<"/topic/[id]">): Promise<Metadata> {
  const id = parseId((await params).id);
  const topic = id ? await getTopic(id) : null;
  if (!topic) return {};
  // まとめた先がある話題は、ページの読み込み後に転送する（200 で返るため）。検索エンジンには、まとめた先を正規の URL として伝える
  if (topic.mergedIntoId) return { alternates: { canonical: `/topic/${topic.mergedIntoId}` }, robots: { index: false, follow: true } };
  const ai = readAiArticle(topic);
  const summary = ai?.lead || (topic.articles.map((a) => displayExcerpt(a.summary, a.publisher)).find(Boolean) ?? undefined);
  const title = ai?.title ?? topic.title;
  return {
    title,
    description: summary,
    alternates: { canonical: `/topic/${topic.id}` },
    // openGraph はレイアウトの値を丸ごと置き換えるため、サイト名と言語もここで指定する
    openGraph: { title, description: summary, type: "article", siteName: siteConfig.name, locale: "ja_JP" },
    // 検索エンジンに登録するのは、独自の価値があるまとめ記事だけ（src/lib/indexing.ts）。
    // 見出しと元記事へのリンクだけのページや、1〜2媒体の言い換えにとどまる記事は登録しない
    robots: isIndexableArticle({ publisherCount: topic.publisherCount, hasAi: !!ai, angles: ai?.angles.length ?? 0, background: ai?.background.length ?? 0 })
      ? undefined
      : { index: false, follow: true },
  };
}

/** 記事ページで最初から見せる元記事の数（残りは「ほか○件」で開く） */
const VISIBLE_SOURCES = 6;

export default async function TopicPage({ params }: PageProps<"/topic/[id]">) {
  const id = parseId((await params).id);
  const topic = id ? await getTopic(id) : null;
  if (!topic) notFound();
  // 同じ出来事の別の話題にまとめたページは、まとめた先へ移す（ブックマークや検索結果から来た人のため）
  if (topic.mergedIntoId) permanentRedirect(`/topic/${topic.mergedIntoId}`);

  const [related, timeline, similar, why] = await Promise.all([
    getTrendingTopics({ genreId: topic.genreId, take: 8, excludeIds: [topic.id] }),
    getEventTimeline(topic.id),
    // 関連するニュース（見出しが似た話題）。失敗してもページは出す
    getRelatedNews(topic.id).catch(() => []),
    // なぜ重要か（照合を通った配信候補の文）。失敗してもページは出す
    getTopicWhy(topic.id).catch(() => null),
  ]);
  // 同じ出来事の流れに出ている話題は、関連するニュースから外す
  const inTimeline = new Set(timeline.map((e) => e.id));
  const similarNews = similar.filter((t) => !inTimeline.has(t.id));
  const ai = readAiArticle(topic);
  const coverage = topic.articles.map((a) => ({ id: a.id, publisher: a.publisher, publishedAt: a.publishedAt, title: a.title, kind: a.source.kind }));
  const times = coverageTimes(coverage);
  const diffs = numberDiffs(coverage, publisherLabel);
  const featureLinks = relatedFeatures(topic);
  // なぜ重要かは、まとめ記事の「なぜ重要」（照合済み）を優先し、なければ配信候補の文を使う
  const brief = buildBrief(ai?.lead, ai?.why?.text ?? why, timeline, topic);
  // 写真は、人物写真（Wikidata で人物と確かめたもの）か、内容に合わせたイメージ写真（どちらも自由利用ライセンス）
  const person = readPhoto(topic.photo);
  const stock = person ? null : stockPhoto(ai?.title ?? topic.title, topic.genre.slug, topic.id);
  const figure = person ? { ...person, stock: false } : stock ? { ...stock, stock: true } : null;
  // 元記事の1件（最初の報道からの経過時間、プレスリリースの印、元記事へのリンク）
  const sourceItem = (a: (typeof topic.articles)[number]) => (
    <li key={a.id} className="relative my-3 flex gap-4 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      <span aria-hidden className="absolute top-5 -left-[27px] h-3 w-3 rounded-full border-2 border-surface bg-accent" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-fg-subtle">
          <span className="font-bold text-fg">{publisherLabel(a.publisher)}</span>
          <time dateTime={a.publishedAt.toISOString()}>{formatDateTime(a.publishedAt)}</time>
          {/* 最初に報じた媒体と、そこから何分後に報じたか（報道機関の記事だけ） */}
          {times.get(a.id)?.first && <span className="rounded bg-accent px-1 font-bold text-accent-fg">最初に報道</span>}
          {times.get(a.id) && !times.get(a.id)!.first && <span className="tabular-nums">{elapsedLabel(times.get(a.id)!.minutes)}</span>}
          {a.source.kind === "SOCIAL" && a.socialCount > 0 && (
            <span className="text-accent">はてなブックマーク {formatNumber(a.socialCount)} users</span>
          )}
          {a.source.kind === "PRESS" && <span className={`rounded border px-1 ${kindTone("プレスリリース")}`}>プレスリリース</span>}
        </div>
        <OutboundLink articleId={a.id} className="headline mt-0.5 block font-bold leading-snug hover:text-accent hover:underline">
          {cleanTitle(a.title)}
        </OutboundLink>
        {/* まとめ記事があるときは要約を繰り返さず、元記事への入口だけを並べる（スマホで縦に長くなりすぎないように） */}
        {displayExcerpt(a.summary, a.publisher) && !ai && <p className="mt-1 text-sm text-fg-muted">{a.summary}</p>}
        <OutboundLink articleId={a.id} className="mt-1 inline-block py-1.5 text-xs font-semibold text-accent hover:underline">
          {publisherLabel(a.publisher)}で続きを読む ↗
        </OutboundLink>
      </div>
      {displayImage(a.imageUrl, a.publisher) && (
        <OutboundLink articleId={a.id} className="relative hidden w-36 shrink-0 self-start overflow-hidden rounded-lg sm:block">
          <Thumbnail src={displayImage(a.imageUrl, a.publisher)} genreSlug={topic.genre.slug} credit={a.publisher} iconClassName="h-6 w-6" className="aspect-[16/9] w-full" />
        </OutboundLink>
      )}
    </li>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ReadingProgress />
      <article className="card min-w-0 overflow-hidden">
        {ai && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd([
                newsArticleJsonLd(topic.id, ai, topic.articles.map((a) => ({ url: a.url, publisher: a.publisher }))),
                breadcrumbJsonLd([
                  { name: "トップ", path: "/" },
                  { name: topic.genre.name, path: `/genre/${topic.genre.slug}` },
                  { name: ai.title, path: `/topic/${topic.id}` },
                ]),
              ]),
            }}
          />
        )}
        <header
          className="px-5 pt-4 pb-5 sm:px-6"
          style={{ background: `linear-gradient(180deg, color-mix(in oklab, var(--g-${topic.genre.slug}) 14%, var(--surface)), var(--surface))` }}
        >
          <nav aria-label="パンくず" className="mb-3 flex items-center gap-1.5 text-xs text-fg-subtle">
            <Link href="/" className="hover:text-fg">トップ</Link>
            <span>›</span>
            <Link href={`/genre/${topic.genre.slug}`} className="flex items-center gap-1 hover:text-fg">
              <GenreIcon slug={topic.genre.slug} className="h-3.5 w-3.5" />
              {topic.genre.name}
            </Link>
          </nav>
          {/* AI まとめ記事があるときは、その見出しをページの見出しにする（同じ話題の見出しを2回並べない） */}
          <h1 className="text-xl leading-snug font-black sm:text-[26px]">{ai?.title ?? topic.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
            <GenreBadge genre={topic.genre} link />
            <MarketEventBadge event={topic.aiMarketEvent} />
            {topic.aiGameKind === "rumor" && <RumorBadge />}
            {topic.publisherCount > 1 && (
              <span className="flex items-center gap-2">
                <PublisherAvatars names={[...new Set(topic.articles.map((a) => publisherLabel(a.publisher)))]} max={6} size="md" />
                <span>
                  <strong className="text-lg font-black text-accent tabular-nums">{topic.publisherCount}</strong>媒体・
                  {topic.articleCount}本の記事
                </span>
              </span>
            )}
            <span className="text-xs">
              最初の報道{" "}
              <Link href={`/daily/${jstDay(topic.firstSeenAt)}`} prefetch={false} className="underline decoration-dotted underline-offset-2 hover:text-accent">
                <time dateTime={topic.firstSeenAt.toISOString()}>{formatDateTime(topic.firstSeenAt)}</time>
              </Link>
              {topic.lastSeenAt > topic.firstSeenAt && (
                <>
                  {" "}／ 最新 <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
                </>
              )}
            </span>
          </div>
          <div className="mt-3">
            <SaveButton id={topic.id} title={ai?.title ?? topic.title} />
          </div>
        </header>

        <div className="px-5 pb-5 sm:px-6">
          {figure && (
            <figure className="mb-5">
              <Thumbnail src={figure.url} genreSlug={topic.genre.slug} portrait={!figure.stock} priority className="aspect-[16/9] w-full rounded-xl object-cover" sizes="(max-width: 768px) 100vw, 720px" />
              {/* 自由利用ライセンスの写真の作者・ライセンス（CC BY・CC BY-SA の表示）。イメージ写真は出来事の写真でないと明記する */}
              <figcaption className="mt-1 text-[11px] text-fg-subtle">
                {figure.stock ? "イメージ写真・" : "写真："}
                <a href={figure.page} target="_blank" rel="noopener noreferrer license" className="underline decoration-dotted underline-offset-2 hover:text-fg">
                  {figure.credit}（Wikimedia Commons）
                </a>
              </figcaption>
            </figure>
          )}
          {brief && <TopicBrief brief={brief} lastSeenAt={topic.lastSeenAt} />}
          {ai && (
            <div className="mb-6">
              <AiArticleView
                hideLead={!!brief}
                article={ai}
                sources={topic.articles.map((a) => ({ id: a.id, publisher: a.publisher }))}
                showTitle={false}
                reportHref={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(`【誤りの報告】${ai.title}`)}&body=${encodeURIComponent(`${siteConfig.url}/topic/${topic.id}\n\n誤っている箇所：\n正しい内容（分かれば出典も）：\n`)}`}
              />
              <div className="mt-4">
                <FeedbackButtons topicId={topic.id} />
              </div>
              {/* 共有は読み終えた位置に置く（本文より先に並べると、読む前に場所を取る） */}
              <div className="mt-3">
                <ShareButtons title={ai.title} url={`${siteConfig.url}/topic/${topic.id}`} />
              </div>
            </div>
          )}
          {/* この話題に関わる特集・データのページ（発売日・放送日・値上げなど、日付のある話題だけ） */}
          {featureLinks.length > 0 && (
            <nav aria-label="関連する特集" className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-fg-muted">関連する特集</span>
              {featureLinks.map((l) => (
                <Link key={l.href} href={l.href} prefetch={false} className="rounded-full border border-accent/40 bg-accent-soft/40 px-3 py-1 font-bold text-accent hover:bg-accent-soft">
                  {l.label} →
                </Link>
              ))}
            </nav>
          )}
          <EventTimeline entries={timeline} currentId={topic.id} />
        <h2 className="mt-2 mb-1 text-sm font-bold text-fg-muted">{ai ? "元の記事（古い順）" : "各媒体の報道（古い順）"}</h2>
        {/* 見出しの数字が媒体で分かれているとき（報じた時点の違いなど）。どの媒体がどの数字かを並べる */}
        {diffs.length > 0 && (
          <div className="my-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-bold">見出しの数字が媒体によって異なります</p>
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {diffs.map((d) => (
                <li key={d.label}>
                  {d.values.map((v) => `${v.value}（${v.publishers.join("・")}）`).join(" ／ ")}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-fg-subtle">報じた時点や数え方の違いによることがあります。最新の情報は各社の記事でご確認ください。</p>
          </div>
        )}
        <ol className="relative border-l-2 border-border pl-5">{topic.articles.slice(0, VISIBLE_SOURCES).map(sourceItem)}</ol>
        {/* 元記事が多い話題は、残りを畳む（スマホで縦に長くなりすぎないように。開けばすべて見られる） */}
        {topic.articles.length > VISIBLE_SOURCES && (
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center rounded-xl border border-border text-sm font-bold text-accent hover:bg-surface-muted">
              <span className="group-open:hidden">ほか{topic.articles.length - VISIBLE_SOURCES}件の記事を見る</span>
              <span className="hidden group-open:inline">閉じる</span>
            </summary>
            <ol className="relative border-l-2 border-border pl-5">{topic.articles.slice(VISIBLE_SOURCES).map(sourceItem)}</ol>
          </details>
        )}
        {!ai && (
          <div className="mt-4">
            <ShareButtons title={topic.title} url={`${siteConfig.url}/topic/${topic.id}`} />
          </div>
        )}
        </div>
      </article>

      <aside className="min-w-0 space-y-6">
        {/* 関連するニュースと同じジャンルの話題は、タブで切り替える（スマホで縦に2つ並べると長くなるため） */}
        <section className="card p-4" aria-label="次に読む">
          <SectionHeading title="次に読む" href={`/genre/${topic.genre.slug}`} moreLabel={`${topic.genre.name}をもっと`} genreSlug={topic.genre.slug} />
          <GroupTabs
            id="topic-next"
            label="次に読むニュースの種類"
            groups={[
              ...(similarNews.length > 0
                ? [{ key: "similar", label: "関連するニュース", content: <TopicList topics={similarNews} variant="compact" showGenre /> }]
                : []),
              { key: "genre", label: `${topic.genre.name}の話題`, content: <TopicList topics={related} variant="compact" showGenre={false} /> },
            ]}
          />
        </section>
      </aside>
    </div>
  );
}

/** 話題に読み取った日付（発売日・放送日・変更の日）から、関連する特集とデータのページを選ぶ */
function relatedFeatures(t: {
  aiGameRelease: string | null;
  aiAnimeDate: string | null;
  aiChangeDate: string | null;
  aiChangeKind: string | null;
  aiGameTitle: string | null;
  aiGameKey: string | null;
  aiAnimeTitle: string | null;
}) {
  const links: { href: string; label: string }[] = [];
  // 作品ページ（発売日・放送日とこれまでのニュース）を先に
  if (t.aiGameTitle) links.push({ href: workPath("game", workKey(t.aiGameKey || t.aiGameTitle)), label: `${t.aiGameTitle}の発売日・最新情報` });
  if (t.aiAnimeTitle) links.push({ href: workPath("anime", workKey(t.aiAnimeTitle)), label: `${t.aiAnimeTitle}はいつから？` });
  const add = (kind: FeatureKind, date: string | null) => {
    const month = date?.slice(0, 7);
    if (month && isFeatureMonth(month)) links.push({ href: featurePath(kind, month), label: featureShortName(kind, month) });
  };
  add("games", t.aiGameRelease);
  add("anime", t.aiAnimeDate);
  add("changes", t.aiChangeDate);
  if (t.aiChangeKind === "price_up" || t.aiChangeKind === "price_down") links.push({ href: "/prices", label: "値上げ・値下げデータベース" });
  if (links.length > 0) links.push({ href: "/calendar", label: "ぜんぶカレンダー" });
  return links;
}
