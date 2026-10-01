import type { Metadata } from "next";
import { TopicList } from "@/components/topic-card";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getTopicsSince } from "@/lib/queries";

export const metadata: Metadata = {
  title: "前回からの新着",
  robots: { index: false, follow: true },
};

/** 遡れる最大の期間（それより前の訪問でも、この期間に絞る） */
const MAX_DAYS = 7;

function readSince(raw: string | string[] | undefined): Date {
  const now = Date.now();
  const v = Number(Array.isArray(raw) ? raw[0] : raw);
  const oldest = now - MAX_DAYS * 86_400_000;
  return new Date(Number.isFinite(v) ? Math.min(Math.max(v, oldest), now) : now - 86_400_000);
}

export default async function NewSincePage({ searchParams }: PageProps<"/new">) {
  const since = readSince((await searchParams).since);
  const { items, total } = await getTopicsSince(since, 50);
  return (
    <section className="mx-auto max-w-3xl card p-4 sm:p-6">
      <h1 className="text-xl font-extrabold">前回からの新着</h1>
      <p className="mt-1 mb-2 text-sm text-fg-muted">
        {formatDateTime(since)}以降に初めて報じられた話題 {formatNumber(total)}件
        {total > items.length && `（話題の大きい上位${items.length}件）`}
        。話題の大きい順です。
      </p>
      <TopicList topics={items} emptyText="前回の訪問から新しい話題はまだありません。" />
    </section>
  );
}
