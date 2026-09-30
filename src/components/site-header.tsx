import Link from "next/link";
import { siteConfig } from "@/config/site";
import { getGenres } from "@/lib/queries";
import { GenreNav } from "./genre-nav";
import { SearchForm } from "./search-form";

export async function SiteHeader() {
  const genres = await getGenres();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 pb-1">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-extrabold tracking-tight text-accent">{siteConfig.name}</span>
          <span className="hidden text-xs text-fg-subtle sm:inline">{siteConfig.tagline}</span>
        </Link>
        <SearchForm className="order-last w-full sm:order-none sm:ml-auto sm:w-80" />
      </div>
      <div className="mx-auto max-w-6xl px-2">
        <GenreNav genres={genres.map((g) => ({ slug: g.slug, name: g.name }))} />
      </div>
    </header>
  );
}
