import type { ReactNode } from "react";

type Props = { articleId: number; className?: string; children: ReactNode; title?: string };

/** 元記事へのリンク。/go 経由でクリック数を集計してから遷移する */
export function OutboundLink({ articleId, className, children, title }: Props) {
  return (
    <a href={`/go/${articleId}`} target="_blank" rel="noopener nofollow" className={className} title={title}>
      {children}
    </a>
  );
}
