import type { Metadata } from "next";
import { Pagination, parsePage } from "@/components/pagination";
import { TopicCard } from "@/components/topic-card";
import { formatNumber } from "@/lib/format";
import { getAiArticles } from "@/lib/queries";

const PER_PAGE = 24;

export const metadata: Metadata = {
  title: "まとめ記事",
  description: "複数のメディアが報じた話題を、AIが各媒体の報道をもとに要点と出典付きでまとめた記事の一覧です。",
  alternates: { canonical: "/articles" },
};

export default async function ArticlesPage({ searchParams }: PageProps<"/articles">) {
  const page = parsePage((await searchParams).page);
  const { items, total } = await getAiArticles((page - 1) * PER_PAGE, PER_PAGE);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-black tracking-tight">まとめ記事</h1>
        <p className="mt-1 text-sm text-fg-muted">
          複数のメディアが報じた話題を、AIが各媒体の報道をもとに要点と出典付きでまとめました。全{formatNumber(total)}本。
        </p>
      </header>
      {items.length === 0 ? (
        <p className="card p-6 text-sm text-fg-subtle">まとめ記事は準備中です。大きな話題が集まると、ここに記事が追加されます。</p>
      ) : (
        // 写真の大きいカードだとスマホで1画面に1本しか入らないため、写真の小さい詰めた一覧にする
        <div className="card divide-y divide-border px-4">
          {items.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </div>
      )}
      <Pagination
        page={page}
        totalPages={Math.min(50, Math.ceil(total / PER_PAGE))}
        href={(p) => (p > 1 ? `/articles?page=${p}` : "/articles")}
      />
    </div>
  );
}
