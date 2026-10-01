import type { ReactNode } from "react";
import { OutboundLink } from "./outbound-link";

export type LinkableArticle = { id: number; topic?: { id: number; aiGeneratedAt: Date | null } | null };

/**
 * 記事へのリンク。AI まとめ記事がある話題は、サイト内のまとめページを開く（同じタブ）。
 * ない場合は元記事へ。どちらも /go を通るので、ランキング用の閲覧数は数え続けられる
 */
export function ArticleLink({ article, className, tabIndex, children }: { article: LinkableArticle; className?: string; tabIndex?: number; children: ReactNode }) {
  if (article.topic?.aiGeneratedAt) {
    return (
      <a href={`/go/${article.id}?to=summary`} className={className} tabIndex={tabIndex}>
        {children}
      </a>
    );
  }
  return (
    <OutboundLink articleId={article.id} className={className} tabIndex={tabIndex}>
      {children}
    </OutboundLink>
  );
}

/** まとめページへ飛ぶリンクの目印 */
export function SummaryMark({ article }: { article: LinkableArticle }) {
  if (!article.topic?.aiGeneratedAt) return null;
  return <span className="rounded bg-accent-soft px-1.5 py-px text-[10px] font-bold text-accent">まとめ</span>;
}
