import type { AiArticle } from "@/lib/ai/article";
import { formatDateTime } from "@/lib/format";
import { OutboundLink } from "./outbound-link";

type Source = { id: number; publisher: string };

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

/** 出典番号を元記事へのリンクにする */
function Cite({ n, source }: { n: number; source?: Source }) {
  if (!source) return null;
  return (
    <OutboundLink
      articleId={source.id}
      title={`${source.publisher}の記事`}
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
  reportHref,
}: {
  article: AiArticle;
  sources: Source[];
  showTitle?: boolean;
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

  return (
    <section aria-labelledby="ai-article" className="rounded-xl border border-accent/30 bg-accent-soft/40 p-5">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold text-accent">
        <span className="rounded-full bg-accent px-2 py-0.5 text-accent-fg">AIまとめ記事</span>
        {cited.length}媒体の報道をもとに作成
      </p>
      <h2 id="ai-article" className={showTitle ? "text-lg leading-snug font-black sm:text-xl" : "sr-only"}>
        {article.title}
      </h2>
      {article.lead && <p className="mt-2 font-medium">{article.lead}</p>}

      <h3 className="mt-4 mb-1.5 text-sm font-bold text-fg-muted">ポイント</h3>
      <ul className="space-y-1.5">
        {article.points.map((p, i) => (
          <li key={i} className="flex gap-2 text-[15px]">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              {p.text}
              {p.sources.map((n) => (
                <Cite key={n} n={n} source={byNumber(n)} />
              ))}
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

      <div className="mt-4 space-y-3 text-[15px] leading-relaxed">
        {bodyWithoutLead(article).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-3 text-xs text-fg-subtle">
        <p className="mb-1 font-bold">出典</p>
        <ol className="flex flex-wrap gap-x-3 gap-y-1">
          {cited.map(({ n, source }) => (
            <li key={n}>
              <OutboundLink articleId={source.id} className="hover:text-accent hover:underline">
                [{n}] {source.publisher}
              </OutboundLink>
            </li>
          ))}
        </ol>
        <p className="mt-3 leading-relaxed">
          この記事は、上記の媒体が配信した見出しと要約をもとに AI（Claude）が自動で作成しました（{formatDateTime(article.generatedAt)}）。
          誤りを含む可能性があります。正確な内容は各媒体の記事でご確認ください。
        </p>
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
