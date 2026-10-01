import type { Metadata } from "next";
import { companyPath } from "@/lib/company";
import { relativeTime } from "@/lib/format";
import { getCompanyIndex } from "@/lib/queries";
import { CompanyFinder } from "./company-finder";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "企業別ニュース",
  description: "ニュースで取り上げられた企業ごとに、その企業のニュースだけをまとめて読めます。企業名で検索できます。",
  alternates: { canonical: "/company" },
};

export default async function CompaniesPage() {
  const rows = await getCompanyIndex(30, 500);
  const items = rows.map((r) => ({
    name: r.name,
    topics: r.topics,
    ago: relativeTime(r.lastSeenAt),
    latest: r.latest,
    genreSlug: r.genreSlug,
    genreName: r.genreName,
    href: companyPath(r.name),
  }));

  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      <h1 className="text-xl font-extrabold">企業別ニュース</h1>
      <p className="mt-1 mb-4 text-sm text-fg-muted">
        気になる企業を選ぶと、その企業に関するニュースだけを新しい順に読めます。直近1か月にニュースで取り上げた企業が並んでいます。
      </p>
      {items.length === 0 ? (
        <p className="rounded-lg bg-surface-muted p-4 text-sm text-fg-muted">まだありません。</p>
      ) : (
        <CompanyFinder items={items} />
      )}
      <p className="mt-6 text-xs leading-relaxed text-fg-subtle">
        ニュースの整理を目的としたページです。特定の銘柄の売買を勧めるものではありません。
      </p>
    </section>
  );
}
