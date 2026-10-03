import Link from "next/link";
import { cleanTitle } from "@/lib/feed/text";
import { hasPublisherName, publisherLabel } from "@/lib/publisher";
import { displayExcerpt, displayImage } from "@/lib/rights";
import { readPhoto } from "@/lib/photo-data";
import { stockPhoto } from "@/lib/stock-photos";
import { extractNames } from "@/lib/stories/verify";
import { keyTerms } from "@/lib/topics/merge-check";
import type { ReactNode } from "react";
import { relativeTime } from "@/lib/format";
import { marketEventLabel } from "@/lib/market-event";
import { NewBadge } from "./new-badge";
import { ReadTitle } from "./read-title";
import type { TopicCardData } from "@/lib/queries";
import { GenreBadge } from "./genre-badge";
import { OutboundLink } from "./outbound-link";
import { PublisherAvatars } from "./publisher-avatars";
import { RankBadge } from "./rank-badge";
import { Thumbnail } from "./thumbnail";
import { kindTone } from "./kind-badge";

type Variant = "standard" | "compact";

/** 代表記事・要約・媒体一覧など、カード表示に必要な値を取り出す */
function describe(topic: TopicCardData) {
  const primary = topic.articles.filter((a) => a.source.kind !== "SOCIAL");
  const lead = primary[0] ?? topic.articles[0];
  // 要約は当サイトが書いたものを出す。媒体の説明文は、規約で認める媒体のものだけ（lib/rights）
  const excerptOf = (a: (typeof topic.articles)[number]) => displayExcerpt(a.summary, a.publisher);
  const summary = topic.aiLead || ((primary.find(excerptOf) ?? topic.articles.find(excerptOf))?.summary ?? null);
  const publishers = [...new Set(topic.articles.map((a) => publisherLabel(a.publisher)))];
  // 画像は報道機関の記事から選ぶ。SNS 経由の記事は、名前の分かる媒体のものだけ（企業や個人のサイトの画面写真を大きく出さない）
  // 媒体の画像は、規約で表示を認める媒体のものだけ（lib/rights）
  const imageOf = (a: (typeof topic.articles)[number]) => displayImage(a.imageUrl, a.publisher);
  const imageArticle = primary.find(imageOf) ?? topic.articles.find((a) => imageOf(a) && hasPublisherName(a.publisher));
  const mediaImage = imageArticle ? imageOf(imageArticle) : null;
  // 媒体の画像がなければ、人物写真（Wikimedia Commons）か、内容に合わせたイメージ写真を出す（lib/photos・lib/stock-photos）
  const person = mediaImage ? null : readPhoto(topic.photo);
  const stock = mediaImage || person ? null : stockPhoto(topic.aiTitle || topic.title, topic.genre.slug, topic.id);
  const image = mediaImage ?? person?.url ?? stock?.url ?? null;
  // 画像の出典（画像を配信した媒体）
  const imageCredit = imageArticle ? publisherLabel(imageArticle.publisher) : person ? person.credit : stock ? `イメージ・${stock.credit}` : undefined;
  // AI まとめ記事があれば、その見出し（当サイト独自の見出し）を表示する
  const title = topic.aiTitle || cleanTitle(topic.title);
  // 写真がないときに代替表示に出す語（見出しの人名、なければ固有の語）
  const label = image ? undefined : (extractNames(title)[0] ?? [...keyTerms(title)][0]);
  return { lead, title, summary, publishers, image, imageCredit, portrait: Boolean(person), label, hasAi: Boolean(topic.aiGeneratedAt), multi: topic.articleCount > 1 };
}

/** 画像の出典。媒体の画像を表示するときは、画像の右上に媒体名を出す */
function ImageCredit({ credit }: { credit?: string }) {
  if (!credit) return null;
  return <span className="pointer-events-none absolute top-1.5 right-1.5 max-w-[60%] truncate rounded bg-black/55 px-1.5 py-0.5 text-[10px] leading-none text-white/90">画像：{credit}</span>;
}

/** 複数記事のトピックはトピックページへ、単独記事は元記事へ直接リンクする */
/**
 * 話題へのリンク。decorative は画像のリンク（見出しのリンクと同じ行き先）で、
 * 読み上げとキーボード操作では飛ばす（同じリンクを2回読ませない・名前のないリンクを作らない）
 */
function TopicLink({ topic, leadId, className, children, decorative = false }: { topic: TopicCardData; leadId: number; className?: string; children: ReactNode; decorative?: boolean }) {
  const hidden = decorative ? { "aria-hidden": true as const, tabIndex: -1 } : {};
  return topic.articleCount > 1 ? (
    <Link href={`/topic/${topic.id}`} className={className} data-topic-id={topic.id} {...hidden}>
      {children}
    </Link>
  ) : (
    <OutboundLink articleId={leadId} className={className} topicId={topic.id} {...hidden}>
      {children}
    </OutboundLink>
  );
}

function PublisherLine({ publishers, max }: { publishers: string[]; max: number }) {
  return (
    <span className="truncate">
      {publishers.slice(0, max).join("・")}
      {publishers.length > max && ` ほか${publishers.length - max}`}
    </span>
  );
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-accent px-2 py-px text-[11px] font-bold text-accent-fg">
      AIまとめ
    </span>
  );
}

function CoverageBadge({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-px text-[11px] font-bold text-accent">
      {count}媒体が報道
    </span>
  );
}

/** トップの一番大きな枠。ジャンル色のパネルに報道媒体数を大きく示す */
export function HeroTopic({ topic, priority = true, label = "トップニュース" }: { topic: TopicCardData; priority?: boolean; label?: string }) {
  const { lead, title, summary, publishers, image, imageCredit, portrait, label: imageLabel, hasAi } = describe(topic);
  if (!lead) return null;
  return (
    <article className="card group grid h-full overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <TopicLink decorative topic={topic} leadId={lead.id} className={`relative block overflow-hidden md:aspect-auto md:min-h-72 ${image ? "aspect-[16/9]" : "h-28"}`}>
        <Thumbnail
          src={image}
          genreSlug={topic.genre.slug}
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 800px"
          iconClassName="h-16 w-16"
          credit={imageCredit}
          portrait={portrait}
          label={imageLabel}
          className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <ImageCredit credit={image ? imageCredit : undefined} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 flex items-end gap-3 p-4 text-white">
          {/* 写真に文字の多い画面（サイトの画面写真など）でも読めるよう、数字は暗い下地の上に置く */}
          {topic.publisherCount > 1 && (
            <p className="rounded-xl bg-black/65 px-3 py-2 leading-none backdrop-blur-sm">
              <span className="text-5xl font-black tabular-nums">{topic.publisherCount}</span>
              <span className="ml-1 text-sm font-bold">媒体が報道</span>
            </p>
          )}
        </div>
        <span className="absolute top-3 left-3">
          <GenreBadge genre={topic.genre} />
        </span>
      </TopicLink>
      <div className="flex min-w-0 flex-col p-5">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold text-accent">
          {label}
          {hasAi && <AiBadge />}
        </p>
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <h2 className="text-xl leading-snug font-black group-hover:text-accent sm:text-2xl">
            <ReadTitle id={topic.id}>{title}</ReadTitle>
          </h2>
        </TopicLink>
        {summary && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-fg-muted">{summary}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 text-xs text-fg-subtle">
          <PublisherAvatars names={publishers} size="md" />
          <PublisherLine publishers={publishers} max={3} />
          <span className="ml-auto flex items-center gap-1.5">
            <NewBadge since={topic.firstSeenAt} />
            <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
          </span>
        </div>
      </div>
    </article>
  );
}

/** 決算・M&A などの目印（投資家が一覧で見分けられるように） */
export function MarketEventBadge({ event }: { event: string | null | undefined }) {
  const label = marketEventLabel(event);
  if (!label) return null;
  return <span className={`rounded border px-1.5 py-px text-[11px] font-bold ${kindTone(label)}`}>{label}</span>;
}

/** 噂・リーク（公式の発表ではない）の印。事実と見分けられるようにする */
export function RumorBadge() {
  return <span className="rounded border border-dashed border-fg-muted/60 px-1.5 py-px text-[11px] font-bold text-fg-muted">噂・リーク</span>;
}

/** 2列に並べる中サイズのカード */
export function TopicTile({ topic }: { topic: TopicCardData }) {
  const { lead, title, summary, publishers, image, imageCredit, portrait, label: imageLabel, hasAi } = describe(topic);
  if (!lead) return null;
  return (
    <article className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <TopicLink decorative topic={topic} leadId={lead.id} className="relative block aspect-[16/9] overflow-hidden">
        <Thumbnail
          src={image}
          genreSlug={topic.genre.slug}
          credit={imageCredit}
          portrait={portrait}
          label={imageLabel}
          className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <ImageCredit credit={image ? imageCredit : undefined} />
        <span className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <GenreBadge genre={topic.genre} />
          {hasAi && <AiBadge />}
          <MarketEventBadge event={topic.aiMarketEvent} />
          {topic.aiGameKind === "rumor" && <RumorBadge />}
          {topic.publisherCount > 1 && (
            <span className="rounded-full bg-black/60 px-2 py-px text-[11px] font-bold text-white backdrop-blur">
              {topic.publisherCount}媒体が報道
            </span>
          )}
        </span>
      </TopicLink>
      <div className="flex flex-1 flex-col p-4">
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <h3 className="leading-snug font-bold group-hover:text-accent">
            <ReadTitle id={topic.id}>{title}</ReadTitle>
          </h3>
        </TopicLink>
        {summary && <p className="mt-1.5 line-clamp-2 text-[13px] text-fg-muted">{summary}</p>}
        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-fg-subtle">
          <PublisherAvatars names={publishers} max={4} />
          <PublisherLine publishers={publishers} max={2} />
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <NewBadge since={topic.firstSeenAt} />
            <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
          </span>
        </div>
      </div>
    </article>
  );
}

type CardProps = { topic: TopicCardData; variant?: Variant; showGenre?: boolean; rank?: number };

/** 一覧の1行 */
export function TopicCard({ topic, variant = "standard", showGenre = true, rank }: CardProps) {
  const { lead, title, summary, publishers, image, imageCredit, portrait, label: imageLabel, hasAi } = describe(topic);
  if (!lead) return null;
  const compact = variant === "compact";
  return (
    <article className={`group flex gap-3 ${compact ? "py-2.5" : "py-3.5"}`}>
      {rank !== undefined && <RankBadge rank={rank} size="md" />}
      <div className="min-w-0 flex-1">
        <TopicLink topic={topic} leadId={lead.id} className="headline">
          <span className={`${compact ? "text-sm font-medium" : "text-[15px] font-bold"} leading-snug group-hover:text-accent`}>
            <ReadTitle id={topic.id}>{title}</ReadTitle>
          </span>
        </TopicLink>
        {!compact && summary && <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{summary}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          {showGenre && <GenreBadge genre={topic.genre} />}
          {hasAi && <AiBadge />}
          <MarketEventBadge event={topic.aiMarketEvent} />
          {topic.aiGameKind === "rumor" && <RumorBadge />}
          <CoverageBadge count={topic.publisherCount} />
          {topic.publisherCount > 1 && !compact && <PublisherAvatars names={publishers} max={4} />}
          <PublisherLine publishers={publishers} max={compact ? 2 : 3} />
          <NewBadge since={topic.firstSeenAt} />
          <time dateTime={topic.lastSeenAt.toISOString()}>{relativeTime(topic.lastSeenAt)}</time>
        </div>
      </div>
      {!compact && (
        <TopicLink decorative topic={topic} leadId={lead.id} className="relative block h-[72px] w-24 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-32">
          <Thumbnail src={image} genreSlug={topic.genre.slug} credit={imageCredit} portrait={portrait} label={imageLabel} iconClassName="h-6 w-6" className="absolute inset-0 h-full w-full" />
        </TopicLink>
      )}
    </article>
  );
}

export function TopicList({
  topics,
  variant,
  showGenre,
  ranked = false,
  emptyText = "該当するニュースはまだありません。",
}: {
  topics: TopicCardData[];
  variant?: Variant;
  showGenre?: boolean;
  ranked?: boolean;
  emptyText?: string;
}) {
  if (topics.length === 0) return <p className="py-6 text-sm text-fg-subtle">{emptyText}</p>;
  return (
    <div className="divide-y divide-border">
      {topics.map((t, i) => (
        <TopicCard key={t.id} topic={t} variant={variant} showGenre={showGenre} rank={ranked ? i + 1 : undefined} />
      ))}
    </div>
  );
}
