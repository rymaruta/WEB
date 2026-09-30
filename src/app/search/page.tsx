import type { Metadata } from "next";
import { Pagination, parsePage } from "@/components/pagination";
import { SearchForm } from "@/components/search-form";
import { TopicList } from "@/components/topic-card";
import { formatNumber } from "@/lib/format";
import { searchTopics } from "@/lib/queries";

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
  const { items, total } = q ? await searchTopics(q, (page - 1) * PER_PAGE, PER_PAGE) : { items: [], total: 0 };

  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      <h1 className="mb-4 text-xl font-extrabold">ニュース検索</h1>
      <SearchForm defaultValue={q} />
      {q && (
        <>
          <p className="mt-5 mb-1 text-sm text-fg-muted">
            「<span className="font-bold text-fg">{q}</span>」に一致するトピック {formatNumber(total)}件（新しい順）
          </p>
          <TopicList topics={items} emptyText="一致するニュースは見つかりませんでした。別のキーワードをお試しください。" />
          <Pagination
            page={page}
            totalPages={Math.min(50, Math.ceil(total / PER_PAGE))}
            href={(p) => `/search?${new URLSearchParams({ q, ...(p > 1 ? { page: String(p) } : {}) })}`}
          />
        </>
      )}
    </section>
  );
}
