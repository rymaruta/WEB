import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FeatureNav } from "@/components/feature-nav";
import { featurePath, getFeature, isFeatureKind, isFeatureMonth, type FeatureItem } from "@/lib/features";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";
import { siteConfig } from "@/config/site";

export const revalidate = 600;

async function load(params: Promise<{ kind: string; month: string }>) {
  const { kind, month } = await params;
  if (!isFeatureKind(kind) || !isFeatureMonth(month)) return null;
  return getFeature(kind, month);
}

export async function generateMetadata({ params }: PageProps<"/feature/[kind]/[month]">): Promise<Metadata> {
  const f = await load(params);
  if (!f) return {};
  return {
    title: f.title,
    description: f.description,
    alternates: { canonical: featurePath(f.kind, f.month) },
    openGraph: { title: f.title, description: f.description, type: "website", siteName: siteConfig.name, locale: "ja_JP" },
    // 中身のない月は検索エンジンに登録しない
    robots: f.items.length ? undefined : { index: false, follow: true },
  };
}

/** 日付の見出し（10月1日（木）、10月中） */
function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!d) return `${m}月中`;
  const w = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}月${d}日（${w}）`;
}

function Row({ item }: { item: FeatureItem }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug font-bold group-hover:text-accent">
          {item.title}
          {item.url && <span className="ml-1 text-[11px] font-normal text-fg-subtle">↗</span>}
        </span>
        {item.note && <span className="mt-0.5 block text-xs text-fg-subtle">{item.note}</span>}
      </span>
      {item.label && <span className="max-w-[40%] shrink-0 truncate text-xs text-fg-muted">{item.label}</span>}
    </>
  );
  const cls = "group flex items-start gap-3 py-2.5";
  if (item.topicId)
    return (
      <Link href={`/topic/${item.topicId}`} prefetch={false} className={cls}>
        {body}
      </Link>
    );
  if (item.url)
    return (
      <a href={item.url} target="_blank" rel="noopener nofollow" className={cls}>
        {body}
      </a>
    );
  return <div className={cls}>{body}</div>;
}

export default async function FeaturePage({ params }: PageProps<"/feature/[kind]/[month]">) {
  const f = await load(params);
  if (!f) notFound();
  const path = featurePath(f.kind, f.month);
  // 日付ごとにまとめる（月だけのものは最後に）
  const groups = new Map<string, FeatureItem[]>();
  for (const it of f.items) groups.set(it.date, [...(groups.get(it.date) ?? []), it]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd([
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "特集", path: "/feature" },
              { name: f.title, path },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: f.title,
              numberOfItems: f.items.length,
              itemListElement: f.items.slice(0, 100).map((it, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `${dayLabel(it.date)} ${it.title}`,
                ...(it.topicId ? { url: `${siteConfig.url}/topic/${it.topicId}` } : {}),
              })),
            },
          ]),
        }}
      />
      <nav aria-label="パンくず" className="text-xs text-fg-subtle">
        <Link href="/" className="hover:text-accent">
          トップ
        </Link>
        <span className="mx-1.5">›</span>
        <Link href="/feature" className="hover:text-accent">
          特集
        </Link>
      </nav>
      <header className="card p-5 sm:p-6">
        <p className="text-xs font-bold text-accent">特集</p>
        <h1 className="mt-1 text-2xl leading-snug font-black">{f.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">{f.lead}</p>
        <FeatureNav current={{ kind: f.kind, month: f.month }} />
      </header>

      {f.items.length > 0 && (
        <section className="card divide-y divide-border px-4 sm:px-6">
          {[...groups].map(([date, items]) => (
            <div key={date} className="py-3">
              <h2 className="text-sm font-black" style={{ color: `var(--g-${f.genreSlug})` }}>
                {dayLabel(date)}
                <span className="ml-2 text-xs font-normal text-fg-subtle">{items.length}件</span>
              </h2>
              <div className="divide-y divide-border">
                {items.map((it) => (
                  <Row key={`${it.title}-${it.topicId ?? it.url}`} item={it} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        ニュースで報じられた日付をもとに自動でまとめています。日付は変わることがあるため、最新の情報は各社の発表でご確認ください。
        {f.sourceNote && <> {f.sourceNote}</>}
      </p>
      {f.kind === "changes" && (
        <p>
          <Link href="/prices" prefetch={false} className="text-sm font-bold text-accent hover:underline">
            値上げ・値下げを会社や品目で探す（値上げ・値下げデータベース） →
          </Link>
        </p>
      )}
      <p>
        <Link href={`/genre/${f.genreSlug}`} className="text-sm font-bold text-accent hover:underline">
          ジャンルのニュース一覧へ →
        </Link>
      </p>
    </div>
  );
}
