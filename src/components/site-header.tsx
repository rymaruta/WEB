import Link from "next/link";
import { getGenres, getLatestArticles } from "@/lib/queries";
import { GenreNav } from "./genre-nav";
import { Logo } from "./logo";
import { NewsTicker } from "./news-ticker";
import { SearchForm } from "./search-form";

const today = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short",
});

export async function SiteHeader() {
  const [genres, latest] = await Promise.all([getGenres(), getLatestArticles(12)]);
  return (
    <>
      {/* スマホでは固定しない（下のメニューで移動できるため、読む場所を広く取る） */}
      <header className="z-20 border-b border-border bg-surface/95 backdrop-blur sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-3 pb-2">
          <Link href="/" prefetch={false} aria-label="トップページ">
            <Logo />
          </Link>
          <p className="hidden text-xs font-medium text-fg-muted md:block">{today.format(new Date())}</p>
          {/* スマホでは検索は下のメニューから（上に置くと最初に見えるニュースが減る） */}
          <SearchForm className="hidden sm:ml-auto sm:block sm:w-80" />
        </div>
        <div className="mx-auto max-w-6xl px-2">
          <GenreNav genres={genres.map((g) => ({ slug: g.slug, name: g.name }))} />
        </div>
      </header>
      {/* 流れる新着はスマホでは出さない（狭い画面で動き続けると読みにくい） */}
      <div className="hidden sm:block">
        <NewsTicker items={latest} />
      </div>
    </>
  );
}
