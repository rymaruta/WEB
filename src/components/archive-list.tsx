import Link from "next/link";
import { GenreBadge } from "./genre-badge";

export type ArchiveItem = {
  id: number;
  title: string;
  aiTitle: string | null;
  aiLead: string | null;
  publisherCount: number;
  articleCount: number;
  genre?: { slug: string; name: string };
};

/** まとめページ（日付・月間）の1本。見出し・リード・報じた媒体の数 */
export function ArchiveRow({ t, rank, showLead = true }: { t: ArchiveItem; rank?: number; showLead?: boolean }) {
  return (
    <li className="flex gap-3 py-3">
      {rank !== undefined && <span className="w-7 shrink-0 text-2xl leading-none font-black text-accent tabular-nums">{rank}</span>}
      <div className="min-w-0 flex-1">
        <Link href={`/topic/${t.id}`} prefetch={false} className="leading-snug font-bold hover:text-accent">
          {t.aiTitle ?? t.title}
        </Link>
        {showLead && t.aiLead && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-fg-muted">{t.aiLead}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
          {t.genre && <GenreBadge genre={t.genre} />}
          <span>
            <strong className="font-black text-accent tabular-nums">{t.publisherCount}</strong>媒体が報道
          </span>
          <span>{t.articleCount}本の記事</span>
        </p>
      </div>
    </li>
  );
}
