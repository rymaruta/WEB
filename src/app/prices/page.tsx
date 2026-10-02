import type { Metadata } from "next";
import { PriceTable } from "@/components/price-table";
import { getPriceChanges, priceRate } from "@/lib/changes";
import { jstMonth } from "@/lib/features";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "値上げ・値下げデータベース｜いつから・いくらに・どれだけ変わるか",
  description:
    "ニュースで報じられた値上げ・値下げを、始まる日・会社・変更前後の値段・上げ幅とともに一覧にしたデータベースです。会社名や品目で検索できます。",
  alternates: { canonical: "/prices" },
};

export default async function PricesPage() {
  const start = jstMonth(new Date(), -3);
  const items = await getPriceChanges(start);
  const ups = items.filter((p) => p.kind === "price_up");
  const rates = ups.map(priceRate).filter((r): r is number => r !== null && r > 0);
  const avg = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 10) / 10 : null;
  // 月ごとの件数（値上げ・値下げ）
  const months = [-3, -2, -1, 0, 1, 2].map((o) => jstMonth(new Date(), o));
  const byMonth = months.map((m) => ({
    month: m,
    up: items.filter((p) => p.kind === "price_up" && p.date.startsWith(m)).length,
    down: items.filter((p) => p.kind === "price_down" && p.date.startsWith(m)).length,
  }));
  const max = Math.max(1, ...byMonth.map((b) => b.up + b.down));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="card p-5 sm:p-6">
        <h1 className="text-2xl font-black">値上げ・値下げデータベース</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          ニュースで報じられた値上げ・値下げを、始まる日・会社・変更前後の値段とともに集めています。値段や率は、記事に書かれているものだけを載せています。
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-muted p-2">
            <dt className="text-[11px] text-fg-subtle">値上げ</dt>
            <dd className="text-xl font-black text-red-600 tabular-nums dark:text-red-400">{ups.length}件</dd>
          </div>
          <div className="rounded-lg bg-surface-muted p-2">
            <dt className="text-[11px] text-fg-subtle">値下げ</dt>
            <dd className="text-xl font-black text-blue-600 tabular-nums dark:text-blue-400">{items.length - ups.length}件</dd>
          </div>
          <div className="rounded-lg bg-surface-muted p-2">
            <dt className="text-[11px] text-fg-subtle">値上げ幅の平均</dt>
            <dd className="text-xl font-black tabular-nums">{avg !== null ? `${avg}%` : "—"}</dd>
          </div>
        </dl>
        <figure className="mt-4" aria-label="月ごとの件数">
          <div className="flex h-24 items-end gap-2">
            {byMonth.map((b) => (
              <div key={b.month} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-fg-subtle tabular-nums">{b.up + b.down || ""}</span>
                <div className="flex w-full max-w-10 flex-col justify-end" style={{ height: `${((b.up + b.down) / max) * 64}px` }}>
                  <span className="block w-full rounded-t bg-red-500/80" style={{ height: `${b.up + b.down ? (b.up / (b.up + b.down)) * 100 : 0}%` }} />
                  <span className="block w-full bg-blue-500/80" style={{ height: `${b.up + b.down ? (b.down / (b.up + b.down)) * 100 : 0}%` }} />
                </div>
                <span className="text-[11px] text-fg-muted">{Number(b.month.slice(5))}月</span>
              </div>
            ))}
          </div>
          <figcaption className="mt-1 text-[11px] text-fg-subtle">始まる月ごとの件数（赤：値上げ、青：値下げ）</figcaption>
        </figure>
      </header>
      <PriceTable items={items} />
      <p className="text-xs leading-relaxed text-fg-subtle">
        ニュースの見出しと要約から自動で読み取っています。値段は税込み・税抜きが記事によって異なります。最新の情報は各社の発表でご確認ください。
      </p>
    </div>
  );
}
