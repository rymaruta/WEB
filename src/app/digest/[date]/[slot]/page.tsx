import type { Metadata } from "next";
import { publisherLabel } from "@/lib/publisher";
import Link from "next/link";
import { notFound } from "next/navigation";
import { siteConfig } from "@/config/site";
import { digestPath, getPublishedDigest, isDate, slotFromSlug } from "@/lib/digest/archive";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";

export const revalidate = 300;

async function load(params: Promise<{ date: string; slot: string }>) {
  const { date, slot: s } = await params;
  const slot = slotFromSlug(s);
  if (!slot || !isDate(date)) return null;
  return getPublishedDigest(date, slot);
}

export async function generateMetadata({ params }: PageProps<"/digest/[date]/[slot]">): Promise<Metadata> {
  const d = await load(params);
  if (!d) return {};
  const title = `${d.dateLabel}の${d.title}`;
  const description = `${d.dateLabel} ${d.time}に配信した大事なニュース${d.items.length}本：${d.items.map((i) => i.headline).join("／")}`;
  return {
    title,
    description,
    alternates: { canonical: digestPath(d.date, d.slot) },
    openGraph: { title, description, type: "article", siteName: siteConfig.name, locale: "ja_JP" },
  };
}

/** 日ごとの配信ページ。X に投稿した回を、要点・なぜ重要か・出典まで含めてサイトでも読めるようにする */
export default async function DigestPageView({ params }: PageProps<"/digest/[date]/[slot]">) {
  const d = await load(params);
  if (!d) notFound();
  const path = digestPath(d.date, d.slot);

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${d.dateLabel}の${d.title}`,
              itemListElement: d.items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteConfig.url}/topic/${it.topicId}`, name: it.headline })),
            },
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "配信アーカイブ", path: "/digest" },
              { name: `${d.dateLabel}の${d.title}`, path },
            ]),
          ]),
        }}
      />
      <nav aria-label="パンくず" className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <Link href="/" className="hover:text-fg">トップ</Link>
        <span>›</span>
        <Link href="/digest" className="hover:text-fg">配信アーカイブ</Link>
      </nav>
      <header>
        <p className="text-sm font-bold text-fg-muted">
          {d.dateLabel} {d.time} 配信
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{d.title}</h1>
        <p className="mt-2 text-sm text-fg-muted">
          複数の媒体が報じた出来事から、この時間に知っておきたいニュースを{d.items.length}本選びました。
        </p>
      </header>

      <ol className="space-y-4">
        {d.items.map((it, i) => (
          <li key={it.topicId} className="card p-5">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold">
              <span className="text-lg font-black text-fg-muted tabular-nums">{i + 1}</span>
              {it.label && (
                <span className="flex items-center gap-1" style={{ color: it.color }}>
                  <span aria-hidden className="inline-block h-2 w-2" style={{ background: it.color }} />
                  {it.label}
                </span>
              )}
            </div>
            <h2 className="text-lg leading-snug font-black">{it.headline}</h2>
            <ul className="mt-3 space-y-1.5">
              {it.points.map((p, j) => (
                <li key={j} className="flex gap-2 text-[15px]">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            {it.why && (
              <p className="mt-3 text-sm text-fg-muted">
                <span className="font-bold text-fg">なぜ重要か：</span>
                {it.why}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-fg-subtle">
              <span>出典：{[...new Set(it.publishers.map(publisherLabel))].slice(0, 3).join("・")}{it.publishers.length > 3 ? ` ほか${it.publishers.length - 3}` : ""}</span>
              <Link href={`/topic/${it.topicId}`} className="font-bold text-accent hover:underline">
                詳しく読む →
              </Link>
            </div>
          </li>
        ))}
      </ol>

      <p className="text-xs leading-relaxed text-fg-subtle">
        要点は、各媒体が配信した見出しと要約をもとに AI（Claude）が作成し、元の記事と照らし合わせて確認しています。正確な内容は各媒体の記事でご確認ください。
      </p>
      <p className="text-sm">
        <Link href="/digest" className="font-bold text-accent hover:underline">
          ほかの日の配信を見る
        </Link>
      </p>
    </article>
  );
}
