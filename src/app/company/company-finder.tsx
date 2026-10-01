"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CompanyItem = { name: string; topics: number; ago: string; latest: string; genreSlug: string; genreName: string; href: string };

/** 比べやすいよう、全角・半角や大文字・小文字の違いをなくす */
const fold = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** 企業名の検索とジャンルの絞り込みができる一覧 */
export function CompanyFinder({ items }: { items: CompanyItem[] }) {
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");

  const genres = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) if (i.genreSlug && !seen.has(i.genreSlug)) seen.set(i.genreSlug, i.genreName);
    return [...seen.entries()];
  }, [items]);

  const shown = useMemo(() => {
    const key = fold(q);
    return items.filter((i) => (!genre || i.genreSlug === genre) && (!key || fold(i.name).includes(key)));
  }, [items, q, genre]);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${active ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-fg-muted hover:text-fg"}`;

  return (
    <div>
      <label htmlFor="company-q" className="sr-only">
        企業名で探す
      </label>
      <input
        id="company-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="企業名で探す（例：トヨタ、ソニー）"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-[15px] outline-none placeholder:text-fg-subtle focus:border-accent"
      />
      {genres.length > 1 && (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="ジャンルで絞り込む">
          <button type="button" className={chip(!genre)} aria-pressed={!genre} onClick={() => setGenre("")}>
            すべて
          </button>
          {genres.map(([slug, name]) => (
            <button key={slug} type="button" className={chip(genre === slug)} aria-pressed={genre === slug} onClick={() => setGenre(slug)}>
              {name}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-fg-subtle" aria-live="polite">
        {shown.length}社（最近ニュースに出た順）
      </p>
      {shown.length === 0 ? (
        <p className="mt-2 rounded-lg bg-surface-muted p-4 text-sm text-fg-muted">
          見つかりませんでした。まだ記事で取り上げていない企業かもしれません。
        </p>
      ) : (
        <ul className="mt-1 divide-y divide-border">
          {shown.map((c) => (
            <li key={c.name}>
              <Link href={c.href} prefetch={false} className="group flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2">
                    <span className="font-bold group-hover:text-accent">{c.name}</span>
                    <span className="shrink-0 text-xs text-fg-subtle">
                      ニュース{c.topics}件・{c.ago}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-fg-muted">最新：{c.latest}</p>
                </div>
                <span aria-hidden className="shrink-0 text-fg-subtle group-hover:text-accent">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
