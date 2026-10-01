import type { Metadata } from "next";
import Link from "next/link";
import { companyPath } from "@/lib/company";
import { getTopCompanies } from "@/lib/queries";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "企業別ニュース",
  description: "最近ニュースで取り上げられた企業を、話題の多い順に並べています。企業ごとにニュースを時系列で読めます。",
  alternates: { canonical: "/company" },
};

export default async function CompaniesPage() {
  const [week, month] = await Promise.all([getTopCompanies(7, 30), getTopCompanies(30, 120, 2)]);
  const weekNames = new Set(week.map((c) => c.name));
  const others = month.filter((c) => !weekNames.has(c.name));

  const chips = (list: { name: string; topics: number }[]) => (
    <ul className="flex flex-wrap gap-2">
      {list.map((c) => (
        <li key={c.name}>
          <Link
            href={companyPath(c.name)}
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            {c.name}
            <span className="text-xs text-fg-subtle tabular-nums">{c.topics}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      <h1 className="text-xl font-extrabold">企業別ニュース</h1>
      <p className="mt-1 mb-5 text-sm text-fg-muted">ニュースで取り上げられた企業ごとに、話題を時系列で読めます。数字は話題の件数です。</p>
      <h2 className="mb-2 text-sm font-bold text-fg-muted">この1週間</h2>
      {week.length === 0 ? <p className="text-sm text-fg-subtle">まだありません。</p> : chips(week)}
      {others.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-bold text-fg-muted">この1か月</h2>
          {chips(others)}
        </>
      )}
      <p className="mt-6 text-xs leading-relaxed text-fg-subtle">
        ニュースの整理を目的としたページです。特定の銘柄の売買を勧めるものではありません。
      </p>
    </section>
  );
}
