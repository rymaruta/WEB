import type { Metadata } from "next";
import { GenreBadge } from "@/components/genre-badge";
import { formatDateTime } from "@/lib/format";
import { getSourcesWithStats } from "@/lib/queries";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "掲載メディア一覧",
  description: "ニュースの収集元メディアと、収集状況の一覧です。",
  alternates: { canonical: "/sources" },
};

const KIND_LABEL = { NEWS: "報道・専門", PRESS: "プレスリリース", SOCIAL: "話題シグナル" } as const;

export default async function SourcesPage() {
  const sources = await getSourcesWithStats();
  const active = sources.filter((s) => s.active);
  const inactive = sources.filter((s) => !s.active);

  return (
    <section className="card p-4 sm:p-6">
      <h1 className="text-xl font-extrabold">掲載メディア一覧</h1>
      <p className="mt-2 text-sm text-fg-muted">
        各媒体が公開している RSS 等の配信情報から、見出し・短い要約・リンクのみを掲載しています。本文は掲載していません。
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs text-fg-subtle">
            <tr>
              <th className="py-2 pr-3 font-medium">メディア</th>
              <th className="py-2 pr-3 font-medium">ジャンル</th>
              <th className="py-2 pr-3 font-medium">種別</th>
              <th className="py-2 pr-3 text-right font-medium">24時間の記事数</th>
              <th className="py-2 font-medium">最終取得</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {active.map((s) => (
              <tr key={s.id}>
                <td className="py-2 pr-3">
                  <a href={s.siteUrl} target="_blank" rel="noopener" className="font-medium hover:text-accent hover:underline">
                    {s.name}
                  </a>
                </td>
                <td className="py-2 pr-3"><GenreBadge genre={s.genre} /></td>
                <td className="py-2 pr-3 text-fg-muted">{KIND_LABEL[s.kind]}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{s.articles24h}</td>
                <td className="py-2 text-xs text-fg-muted">
                  {s.lastSuccessAt ? formatDateTime(s.lastSuccessAt) : "未取得"}
                  {s.consecutiveFailures > 0 && <span className="ml-2 text-accent">取得エラー</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {inactive.length > 0 && (
        <p className="mt-6 text-xs text-fg-subtle">
          このほか {inactive.length} 件のフィードは、媒体側の方針により現在収集を停止しています。
        </p>
      )}
    </section>
  );
}
