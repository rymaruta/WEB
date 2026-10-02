import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isArchiveMonth, monthLabel, recentDays } from "@/lib/archive";
import { getGenres } from "@/lib/queries";
import { dayLabel } from "@/lib/archive";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/archive/[month]">): Promise<Metadata> {
  const { month } = await params;
  if (!isArchiveMonth(month)) return {};
  return {
    title: `${monthLabel(month)}のニュースまとめ（ジャンル別）`,
    description: `${monthLabel(month)}に報じられた主なニュースを、ジャンル別・日付別に振り返れます。`,
    alternates: { canonical: `/archive/${month}` },
  };
}

export default async function MonthPage({ params }: PageProps<"/archive/[month]">) {
  const { month } = await params;
  if (!isArchiveMonth(month)) notFound();
  const genres = await getGenres();
  const days = recentDays(400).filter((d) => d.startsWith(month));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="card p-5 sm:p-6">
        <p className="text-xs font-bold text-accent">月間まとめ</p>
        <h1 className="mt-1 text-2xl font-black">{monthLabel(month)}のニュース</h1>
      </header>
      <section className="card p-4 sm:p-5">
        <h2 className="mb-2 text-base font-black">ジャンル別</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {genres.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/archive/${month}/${g.slug}`}
                prefetch={false}
                className="block rounded-lg border border-border px-3 py-2 text-sm font-bold hover:border-accent hover:text-accent"
                style={{ borderLeftColor: `var(--g-${g.slug})`, borderLeftWidth: 4 }}
              >
                {g.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {days.length > 0 && (
        <section className="card p-4 sm:p-5">
          <h2 className="mb-2 text-base font-black">日付別</h2>
          <ul className="flex flex-wrap gap-2">
            {days.map((d) => (
              <li key={d}>
                <Link href={`/daily/${d}`} prefetch={false} className="inline-block rounded-full border border-border px-3 py-1 text-xs font-bold hover:border-accent hover:text-accent">
                  {dayLabel(d)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
