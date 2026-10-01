import { siteConfig } from "@/config/site";
import { getGscReport, gscConfigured } from "@/lib/gsc";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Google 検索での見え方（Search Console）。未設定・失敗のときは理由だけを表示する */
export async function SearchConsoleSection() {
  if (!gscConfigured()) {
    return (
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-bold text-fg-muted">Google 検索</h2>
        <p className="text-sm text-fg-subtle">Search Console の連携が未設定です。設定すると、検索での表示回数・クリック数・検索された言葉がここに出ます。</p>
      </section>
    );
  }
  let report;
  try {
    report = await getGscReport(siteConfig.url);
  } catch (e) {
    console.error(JSON.stringify({ event: "gsc", level: "error", message: e instanceof Error ? e.message : String(e) }));
    return (
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-bold text-fg-muted">Google 検索</h2>
        <p className="text-sm font-bold text-accent">{e instanceof Error ? e.message : "Search Console の取得に失敗しました"}</p>
      </section>
    );
  }
  if (!report) return null;
  const max = Math.max(1, ...report.daily.map((d) => d.impressions));

  return (
    <section className="card p-4">
      <h2 className="mb-1 text-sm font-bold text-fg-muted">Google 検索（直近7日）</h2>
      <p className="mb-3 text-xs text-fg-subtle">
        {report.start.slice(5).replace("-", "/")}〜{report.end.slice(5).replace("-", "/")}。Google のデータは2日ほど遅れて確定します
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["検索結果に出た回数", report.totals.impressions.toLocaleString()],
          ["クリックされた回数", report.totals.clicks.toLocaleString()],
          ["クリック率", pct(report.totals.ctr)],
          ["平均順位", report.totals.position ? report.totals.position.toFixed(1) : "-"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] text-fg-subtle">{k}</dt>
            <dd className="text-xl font-black tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      {report.daily.length > 0 && (
        <ul className="mt-4 space-y-1">
          {report.daily.map((d) => (
            <li key={d.date} className="flex items-center gap-2 text-xs">
              <span className="w-12 shrink-0 tabular-nums text-fg-muted">{d.date.slice(5).replace("-", "/")}</span>
              <div className="h-3 flex-1 rounded bg-surface-muted">
                <div className="h-3 rounded bg-accent/70" style={{ width: `${(d.impressions / max) * 100}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right tabular-nums">
                {d.impressions.toLocaleString()}回／{d.clicks.toLocaleString()}クリック
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-bold">検索された言葉</h3>
          {report.queries.length === 0 ? (
            <p className="text-xs text-fg-subtle">まだデータがありません。</p>
          ) : (
            <ol className="space-y-1 text-xs">
              {report.queries.map((q) => (
                <li key={q.query} className="flex justify-between gap-2">
                  <span className="truncate">{q.query}</span>
                  <span className="shrink-0 tabular-nums text-fg-muted">
                    {q.impressions.toLocaleString()}回・{q.clicks}クリック・{q.position.toFixed(0)}位
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h3 className="mb-1 text-xs font-bold">検索から読まれたページ</h3>
          {report.pages.length === 0 ? (
            <p className="text-xs text-fg-subtle">まだデータがありません。</p>
          ) : (
            <ol className="space-y-1 text-xs">
              {report.pages.map((p) => (
                <li key={p.path} className="flex justify-between gap-2">
                  <a href={p.path} className="truncate text-accent hover:underline">
                    {p.path}
                  </a>
                  <span className="shrink-0 tabular-nums text-fg-muted">
                    {p.impressions.toLocaleString()}回・{p.clicks}クリック
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
