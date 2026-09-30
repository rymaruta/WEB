import Link from "next/link";

type Props = { page: number; totalPages: number; href: (page: number) => string };

export function Pagination({ page, totalPages, href }: Props) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2,
  );
  const cls = "min-w-9 rounded-md border px-3 py-1.5 text-center text-sm";
  return (
    <nav aria-label="ページ送り" className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 && (
        <Link href={href(page - 1)} className={`${cls} border-border bg-surface hover:border-accent`} rel="prev">
          前へ
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - pages[i - 1] > 1 && <span className="text-fg-subtle">…</span>}
          {p === page ? (
            <span aria-current="page" className={`${cls} border-accent bg-accent font-bold text-accent-fg`}>
              {p}
            </span>
          ) : (
            <Link href={href(p)} className={`${cls} border-border bg-surface hover:border-accent`}>
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < totalPages && (
        <Link href={href(page + 1)} className={`${cls} border-border bg-surface hover:border-accent`} rel="next">
          次へ
        </Link>
      )}
    </nav>
  );
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}
