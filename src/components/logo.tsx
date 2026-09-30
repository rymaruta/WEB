import { siteConfig } from "@/config/site";

/** ロゴマーク（重なった見出しの帯）とサイト名 */
export function Logo({ tagline = true }: { tagline?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <rect x="7" y="8" width="18" height="4" rx="2" fill="white" />
        <rect x="7" y="14.5" width="13" height="3.5" rx="1.75" fill="white" opacity="0.85" />
        <rect x="7" y="20.5" width="16" height="3.5" rx="1.75" fill="white" opacity="0.65" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-xl font-black tracking-tight">{siteConfig.name}</span>
        {tagline && <span className="mt-1 hidden text-[11px] text-fg-subtle sm:block">{siteConfig.tagline}</span>}
      </span>
    </span>
  );
}
