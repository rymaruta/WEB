import type { Metadata } from "next";
import { Pagination, parsePage } from "@/components/pagination";
import { SearchForm } from "@/components/search-form";
import { TopicList } from "@/components/topic-card";
import { formatNumber } from "@/lib/format";
import Link from "next/link";
import { companyPath } from "@/lib/company";
import { findCompaniesByName, getTrendingKeywords, searchTopics } from "@/lib/queries";

const PER_PAGE = 20;

function readQuery(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : (value ?? "")).trim().slice(0, 100);
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = readQuery((await searchParams).q);
  return { title: q ? `「${q}」の検索結果` : "ニュース検索", robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = readQuery(sp.q);
  const page = parsePage(sp.page);
  const [{ items, total }, keywords] = await Promise.all([
    q ? searchTopics(q, (page - 1) * PER_PAGE, PER_PAGE) : { items: [], total: 0 },
    getTrendingKeywords(12),
  ]);
  // 企業名で検索した人には、その企業のニュースだけを集めたページを先に案内する
  const companies = q ? await findCompaniesByName(q, 3) : [];
  // 検索前と、見つからなかったときは、いま話題のキーワードから選べるようにする
  const showKeywords = keywords.length > 0 && (!q || total === 0);

  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-extrabold">ニュース検索</h1>
      <SearchForm defaultValue={q} />
      {q && (
        <>
          {companies.length > 0 && (
            <ul className="mt-4 space-y-2">
              {companies.map((c) => (
                <li key={c.name}>
                  <Link
                    href={companyPath(c.name)}
                    prefetch={false}
                    className="flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3 text-sm font-bold hover:bg-accent-soft"
                  >
                    <span>
                      {c.name}のニュースをまとめて見る
                      <span className="ml-2 text-xs font-medium text-fg-subtle">{c.topics}件</span>
                    </span>
                    <span aria-hidden className="text-accent">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 mb-1 text-sm text-fg-muted">
            「<span className="font-bold text-fg">{q}</span>」に一致するトピック {formatNumber(total)}件（見出しに含むものを先に、新しい順）
          </p>
          <TopicList topics={items} emptyText="一致するニュースは見つかりませんでした。別のキーワードをお試しください。" />
          <Pagination
            page={page}
            totalPages={Math.ceil(total / PER_PAGE)}
            href={(p) => `/search?${new URLSearchParams({ q, ...(p > 1 ? { page: String(p) } : {}) })}`}
          />
        </>
      )}
      {showKeywords && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-fg-muted">いま話題のキーワード</h2>
          <ul className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <li key={k}>
                <Link
                  href={`/search?${new URLSearchParams({ q: k })}`}
                  prefetch={false}
                  className="inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
                >
                  {k}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!q && <p className="mt-6 text-xs text-fg-subtle">複数の言葉をスペースで区切ると、すべてを含むニュースに絞り込めます。</p>}
    </section>
  );
}
