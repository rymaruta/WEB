import type { StoredExplainer } from "@/lib/ai/explainer";

/**
 * 「◯◯とは」（その話題を知らない人向けの解説）。まとめ記事の報道には書かれていない基本（作品・企業・制度など）を、
 * 公式サイトなどの出典で調べて書いたもの。各文の後ろに出典の番号を付け、出典のページへリンクする
 */
export function TopicExplainer({ explainer }: { explainer: StoredExplainer }) {
  return (
    <section aria-labelledby="explainer-heading" className="mb-6 rounded-xl border border-border bg-surface-muted/50 p-4">
      <h2 id="explainer-heading" className="mb-2 text-base font-black">
        「{explainer.subject}」とは
      </h2>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {explainer.items.map((item, i) => (
          <li key={i} className="flex gap-1.5">
            <span aria-hidden className="text-fg-subtle">
              ・
            </span>
            <span>
              {item.text}
              {item.refs.map((n) => (
                <a key={n} href={`#explainer-ref-${n}`} className="ml-0.5 align-super text-[10px] font-bold text-accent hover:underline" aria-label={`出典${n}`}>
                  [{n}]
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <ol className="mt-3 space-y-0.5 border-t border-border pt-2 text-xs text-fg-muted">
        {explainer.refs.map((r, i) => (
          <li key={r.url} id={`explainer-ref-${i + 1}`}>
            [{i + 1}]{" "}
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-fg">
              {r.title}
            </a>
            <span className="ml-1 text-fg-subtle">（{r.host}）</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-fg-subtle">
        報道には書かれていない基本を、公式サイトなどの出典でAIが調べてまとめました。各文は、出典のページを取得して書かれていることを確かめたものだけを載せています。
      </p>
    </section>
  );
}
