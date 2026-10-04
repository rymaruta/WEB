import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow-button";
import { Pagination, parsePage } from "@/components/pagination";
import { HeroCarousel } from "@/components/hero-carousel";
import { HeroTopic, TopicList } from "@/components/topic-card";
import { companyPath, readCompanyParam } from "@/lib/company";
import { formatNumber } from "@/lib/format";
import { getCompanyEvents, getCompanyTopics } from "@/lib/queries";
import { getCompanyMap } from "@/lib/news-map";
import { NewsMap } from "@/components/news-map";
import { KindBadge } from "@/components/kind-badge";
import { marketEventLabel } from "@/lib/market-event";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/structured-data";

const PER_PAGE = 20;

export async function generateMetadata({ params }: PageProps<"/company/[name]">): Promise<Metadata> {
  const name = readCompanyParam((await params).name);
  const { total } = await getCompanyTopics(name, 0, 1);
  if (total === 0) return {};
  return {
    title: `${name}のニュース`,
    description: `${name}に関する最新ニュースを、複数の媒体の報道からまとめて時系列でお届けします。`,
    alternates: { canonical: companyPath(name) },
    // 話題が1件だけのページは内容が薄いため、検索エンジンには登録しない
    robots: total < 2 ? { index: false, follow: true } : undefined,
  };
}

export default async function CompanyPage({ params, searchParams }: PageProps<"/company/[name]">) {
  const name = readCompanyParam((await params).name);
  const page = parsePage((await searchParams).page);
  const [{ items, total }, events, related] = await Promise.all([
    getCompanyTopics(name, (page - 1) * PER_PAGE, PER_PAGE),
    // 主な出来事・関連する企業は1ページ目だけに出す
    page === 1 ? getCompanyEvents(name) : [],
    // 相関図（同じニュースに出てきた企業・作品・国・チーム）。失敗してもページは出す
    page === 1 ? getCompanyMap(name).catch(() => []) : [],
  ]);
  if (items.length === 0) notFound();
  const heroes = page === 1 ? items.filter((t) => t.publisherCount > 1).slice(0, 3) : [];
  const heroIds = new Set(heroes.map((t) => t.id));
  const md = (d: Date) => {
    const j = new Date(d.getTime() + 9 * 3_600_000);
    return `${j.getUTCMonth() + 1}/${j.getUTCDate()}`;
  };

  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumbJsonLd([
              { name: "トップ", path: "/" },
              { name: "企業別ニュース", path: "/company" },
              { name, path: companyPath(name) },
            ]),
          ),
        }}
      />
      <nav aria-label="パンくず" className="mb-2 flex items-center gap-1.5 text-xs text-fg-subtle">
        <Link href="/" className="hover:text-fg">トップ</Link>
        <span>›</span>
        <Link href="/company" className="hover:text-fg">企業別ニュース</Link>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{name}のニュース</h1>
        <FollowButton follow={{ kind: "company", key: name, label: name }} />
      </div>
      <p className="mt-1 mb-2 text-sm text-fg-muted">
        {name}を取り上げた話題 {formatNumber(total)}件（新しい順）。各社の報道をまとめた記事を読めます。
      </p>
      {/* 1ページ目は、複数の媒体が報じた最近の話題を写真の大きな枠で横にスライドして見せる */}
      {heroes.length > 0 && (
        <div className="mt-4">
          <HeroCarousel label={`${name}の大きな話題`}>
            {heroes.map((t, i) => (
              <HeroTopic key={t.id} topic={t} priority={i === 0} label={`${name}の話題`} />
            ))}
          </HeroCarousel>
        </div>
      )}
      {events.length > 0 && (
        <section aria-labelledby="company-events" className="my-4 rounded-xl border border-border p-4">
          <h2 id="company-events" className="mb-2 text-sm font-black">
            最近の主な出来事
          </h2>
          <ol className="space-y-1.5">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/topic/${e.id}`} prefetch={false} className="group flex items-center gap-2 text-sm">
                  <span className="w-10 shrink-0 text-xs text-fg-subtle tabular-nums">{md(e.firstSeenAt)}</span>
                  <KindBadge label={marketEventLabel(e.aiMarketEvent) ?? "出来事"} />
                  <span className="min-w-0 flex-1 truncate font-bold group-hover:text-accent">{e.aiTitle ?? e.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      {/* 以前の「よく一緒に報じられる企業」を含む（企業に加えて作品・国・チームも、根拠のニュースつきで） */}
      <NewsMap center={name} links={related} />
      <h2 className="mt-4 text-sm font-black">ニュース</h2>
      <TopicList topics={items.filter((t) => !heroIds.has(t.id))} />
      <Pagination
        page={page}
        totalPages={Math.min(50, Math.ceil(total / PER_PAGE))}
        href={(p) => `${companyPath(name)}${p > 1 ? `?page=${p}` : ""}`}
      />
      <p className="mt-6 text-xs leading-relaxed text-fg-subtle">
        ニュースの整理を目的としたページです。特定の銘柄の売買を勧めるものではありません。
      </p>
    </section>
  );
}
