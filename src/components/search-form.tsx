type Props = { defaultValue?: string; className?: string; id?: string };

/** 表示・非表示の切り替えは外側の要素で行う（form の flex を block などで上書きすると、入力欄とボタンが横に並ばず崩れる） */
export function SearchForm({ defaultValue, className = "", id = "site-search" }: Props) {
  return (
    <form action="/search" role="search" className={`flex items-stretch ${className}`}>
      <label htmlFor={id} className="sr-only">
        ニュースを検索
      </label>
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="キーワードでニュースを検索"
        maxLength={100}
        className="min-w-0 flex-1 rounded-l-md rounded-r-none border border-r-0 border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-fg-subtle focus:border-accent"
      />
      <button
        type="submit"
        className="shrink-0 rounded-r-md bg-accent px-4 text-sm font-semibold whitespace-nowrap text-accent-fg hover:opacity-90"
      >
        検索
      </button>
    </form>
  );
}
