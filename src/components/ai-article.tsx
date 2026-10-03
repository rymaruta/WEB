import type { AiArticle } from "@/lib/ai/article";
import { publisherLabel } from "@/lib/publisher";
import Link from "next/link";
import { companyPath } from "@/lib/company";
import { formatDateTime } from "@/lib/format";
import { citedCounts, POINT_STATUS_LABEL, pointStatus, type PointStatus } from "@/lib/ai/point-status";
import { OutboundLink } from "./outbound-link";

/** kind（NEWS・PRESS・SOCIAL）があれば、要点ごとの確認状況と媒体数を報道機関だけで数える */
type Source = { id: number; publisher: string; kind?: string };

const STATUS_TONE: Record<PointStatus, string> = {
  official: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  multi: "border-accent/40 text-accent",
  single: "border-border text-fg-subtle",
};

/** 要点の確認状況の印（真偽ではなく、出典の種類） */
function StatusTag({ status }: { status: PointStatus }) {
  return <span className={`ml-1.5 inline-block rounded border px-1 align-text-top text-[10px] font-bold whitespace-nowrap ${STATUS_TONE[status]}`}>{POINT_STATUS_LABEL[status]}</span>;
}

const squash = (s: string) => s.replace(/[\s、。,.「」『』（）()]/g, "");

/** 本文の最初の段落がリード文とほぼ同じなら省く（同じ内容を2回読ませない） */
export function bodyWithoutLead(article: Pick<AiArticle, "lead" | "body">): string[] {
  const [first, ...rest] = article.body;
  if (!first || !article.lead) return article.body;
  const a = squash(article.lead);
  const b = squash(first);
  const head = Math.min(20, a.length, b.length);
  return head >= 10 && a.slice(0, head) === b.slice(0, head) ? rest.length ? rest : article.body : article.body;
}

/** 読むのにかかる時間（分）。日本語はおよそ1分に500字として数える */
export function readingMinutes(article: Pick<AiArticle, "lead" | "points" | "angles" | "body">): number {
  const chars = [article.lead, ...article.points.map((p) => p.text), ...article.angles.map((p) => p.text), ...article.body].join("").length;
  return Math.max(1, Math.round(chars / 500));
}

/** 出典番号を元記事へのリンクにする */
function Cite({ n, source }: { n: number; source?: Source }) {
  if (!source) return null;
  return (
    <OutboundLink
      articleId={source.id}
      title={`${publisherLabel(source.publisher)}の記事`}
      className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-accent-soft px-1 align-text-top text-[10px] font-bold text-accent hover:bg-accent hover:text-accent-fg"
    >
      {n}
    </OutboundLink>
  );
}

/** showTitle=false は、ページの見出しが同じ記事のタイトルのとき（見出しを2回並べない） */
export function AiArticleView({
  article,
  sources,
  showTitle = true,
  hideLead = false,
  reportHref,
}: {
  article: AiArticle;
  sources: Source[];
  showTitle?: boolean;
  /** リードを出さない（話題ページの「3行でわかる」に同じ文を出しているとき） */
  hideLead?: boolean;
  /** 誤りの報告先（メールの宛先と件名入りのリンク） */
  reportHref?: string;
}) {
  const byNumber = (n: number) => {
    const id = article.sourceIds[n - 1];
    return sources.find((s) => s.id === id);
  };
  const cited = article.sourceIds
    .map((id, i) => ({ n: i + 1, source: sources.find((s) => s.id === id) }))
    .filter((c): c is { n: number; source: Source } => Boolean(c.source));
  // 確認状況は、資料の種類が分かるときだけ出す
  const typed = sources.every((s) => s.kind) ? sources.map((s) => ({ id: s.id, publisher: s.publisher, kind: s.kind! })) : null;
  const counts = typed ? citedCounts(article.sourceIds, typed) : null;

  return (
    <section aria-labelledby="ai-article" className="rounded-xl border border-accent/30 bg-accent-soft/40 p-5">
      {/* 印と、記事の情報（媒体数・読む時間・更新時刻）を2段に分ける（スマホで1行に詰め込むと折り返して読みにくい） */}
      <div className="mb-2">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-accent">
          <span className="rounded-full bg-accent px-2 py-0.5 whitespace-nowrap text-accent-fg">AIまとめ記事</span>
          <span className="whitespace-nowrap">
            {counts ? `${counts.news}媒体の報道${counts.official ? "と公式発表" : ""}をもとに作成` : `${cited.length}媒体の報道をもとに作成`}
          </span>
        </p>
        <p className="mt-1 text-xs text-fg-subtle">
          約{readingMinutes(article)}分で読めます・{formatDateTime(article.generatedAt)}
          {article.history.length > 1 ? "更新" : "作成"}
        </p>
      </div>
      <h2 id="ai-article" className={showTitle ? "text-lg leading-snug font-black sm:text-xl" : "sr-only"}>
        {article.title}
      </h2>
      {article.lead && !hideLead && <p className="mt-2 font-medium">{article.lead}</p>}

      <h3 className="mt-4 mb-1.5 text-sm font-bold text-fg-muted">ポイント</h3>
      {typed && <p className="-mt-1 mb-1.5 text-[11px] text-fg-subtle">各ポイントの印は、何を出典に書いたかの種類です（内容の真偽の判定ではありません）。</p>}
      <ul className="space-y-1.5">
        {article.points.map((p, i) => (
          <li key={i} className="flex gap-2 text-[15px]">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              {p.text}
              {p.sources.map((n) => (
                <Cite key={n} n={n} source={byNumber(n)} />
              ))}
              {typed && (() => {
                const s = pointStatus(p.sources, article.sourceIds, typed);
                return s && <StatusTag status={s.status} />;
              })()}
            </span>
          </li>
        ))}
      </ul>

      {article.angles.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-sm font-bold text-fg-muted">各社の報じ方</h3>
          <ul className="space-y-1.5 rounded-lg border border-border bg-surface/70 p-3">
            {article.angles.map((p, i) => (
              <li key={i} className="text-[14px] leading-relaxed">
                {p.text}
                {p.sources.map((n) => (
                  <Cite key={n} n={n} source={byNumber(n)} />
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      {article.background.length > 0 && (
        <>
          <h3 className="mt-4 mb-1.5 text-sm font-bold text-fg-muted">これまでの経緯</h3>
          <ol className="space-y-1.5 border-l-2 border-accent/40 pl-3">
            {article.background.map((b) => (
              <li key={b.topicId} className="text-[14px] leading-relaxed">
                {b.text}
                <Link href={`/topic/${b.topicId}`} prefetch={false} className="ml-1 text-xs font-bold whitespace-nowrap text-accent hover:underline">
                  当時のまとめ →
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-4 space-y-3 text-[15px] leading-relaxed">
        {bodyWithoutLead(article).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      {article.companies.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-bold text-fg-muted">関連する企業</span>
          {article.companies.map((c) => (
            <Link
              key={c}
              href={companyPath(c)}
              prefetch={false}
              className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs hover:border-accent hover:text-accent"
            >
              {c}のニュース
            </Link>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-border pt-3 text-xs text-fg-subtle">
        <p className="mb-1 font-bold">出典</p>
        <ol className="flex flex-wrap gap-x-3 gap-y-1">
          {cited.map(({ n, source }) => (
            <li key={n}>
              <OutboundLink articleId={source.id} className="hover:text-accent hover:underline">
                [{n}] {publisherLabel(source.publisher)}
              </OutboundLink>
            </li>
          ))}
        </ol>
        <p className="mt-3 leading-relaxed">
          この記事は、上記の媒体が配信した見出しと要約をもとに AI（Claude）が自動で作成しました（{formatDateTime(article.generatedAt)}）。
          誤りを含む可能性があります。正確な内容は各媒体の記事でご確認ください。
        </p>
        {article.history.length > 1 && (
          <div className="mt-3">
            <p className="mb-1 font-bold">更新履歴</p>
            <ol className="space-y-0.5">
              {article.history.map((h, i) => (
                <li key={h.at.toISOString()}>
                  {formatDateTime(h.at)}　
                  {/* 記録しているのは材料にした記事の数（公式発表を含む）。報道機関の媒体数とは限らないため「記事」と書く */}
                  {i === 0
                    ? `${h.sources}件の記事をもとに作成`
                    : h.sources > article.history[i - 1].sources
                      ? `材料の記事が${h.sources}件に増えたため内容を更新`
                      : "内容を見直して更新"}
                </li>
              ))}
            </ol>
          </div>
        )}
        {reportHref && (
          <p className="mt-2">
            <a href={reportHref} className="font-bold text-accent underline">
              誤りを報告する
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
