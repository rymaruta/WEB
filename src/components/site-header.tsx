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
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-3 pb-2">
          <Link href="/" aria-label="トップページ">
            <Logo />
          </Link>
          <p className="hidden text-xs font-medium text-fg-muted md:block">{today.format(new Date())}</p>
          <SearchForm className="order-last w-full sm:order-none sm:ml-auto sm:w-80" />
        </div>
        <div className="mx-auto max-w-6xl px-2">
          <GenreNav genres={genres.map((g) => ({ slug: g.slug, name: g.name }))} />
        </div>
      </header>
      <NewsTicker items={latest} />
    </>
  );
}
