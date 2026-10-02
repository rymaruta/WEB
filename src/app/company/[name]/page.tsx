import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/follow-button";
import { Pagination, parsePage } from "@/components/pagination";
import { TopicList } from "@/components/topic-card";
import { companyPath, readCompanyParam } from "@/lib/company";
import { formatNumber } from "@/lib/format";
import { getCompanyTopics } from "@/lib/queries";
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
  const { items, total } = await getCompanyTopics(name, (page - 1) * PER_PAGE, PER_PAGE);
  if (items.length === 0) notFound();

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
      <TopicList topics={items} />
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
