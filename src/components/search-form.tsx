type Props = { defaultValue?: string; className?: string };

export function SearchForm({ defaultValue, className = "" }: Props) {
  return (
    <form action="/search" role="search" className={`flex ${className}`}>
      <label htmlFor="site-search" className="sr-only">
        ニュースを検索
      </label>
      <input
        id="site-search"
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="キーワードでニュースを検索"
        maxLength={100}
        className="min-w-0 flex-1 rounded-l-md border border-r-0 border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-fg-subtle focus:border-accent"
      />
      <button
        type="submit"
        className="rounded-r-md bg-accent px-4 text-sm font-semibold text-accent-fg hover:opacity-90"
      >
        検索
      </button>
    </form>
  );
}
